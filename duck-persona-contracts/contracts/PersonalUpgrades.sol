// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./DuckNFT.sol";
import "./SkillStore.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract PersonaUpgrades is Ownable, Pausable, ReentrancyGuard {
    struct EquippedSkill {
        uint256 skillId;
        uint8 tier;
        uint256 equippedAt;
    }

    struct DuckLoadout {
        EquippedSkill[] skills;
        mapping(uint256 => bool) hasSkill;
        uint256 lastUpgrade;
    }

    mapping(uint256 => DuckLoadout) public duckLoadouts;
    mapping(uint256 => uint256) public upgradeCooldowns; // tokenId => timestamp
    
    DuckNFT public duckNFT;
    SkillStore public skillStore;
    IERC20 public duckToken;
    
    uint256 public constant UPGRADE_COOLDOWN = 1 hours;
    uint256 public constant MAX_EQUIPPED_SKILLS = 5;

    event SkillEquipped(uint256 indexed tokenId, uint256 indexed skillId, uint8 tier);
    event SkillUnequipped(uint256 indexed tokenId, uint256 indexed skillId);
    event DuckUpgraded(uint256 indexed tokenId, uint256 cost);

    modifier onlyOrchestrator() {
        require(duckNFT.authorizedOrchestrators(msg.sender) || msg.sender == owner(), "Not authorized");
        _;
    }

    constructor(address _duckNFT, address _skillStore, address _duckToken, address initialOwner)
        Ownable(initialOwner)
    {
        duckNFT = DuckNFT(_duckNFT);
        skillStore = SkillStore(_skillStore);
        duckToken = IERC20(_duckToken);
    }

    function equipSkill(uint256 tokenId, uint256 skillId, uint8 tier) external whenNotPaused nonReentrant {
        require(duckNFT.ownerOf(tokenId) == msg.sender, "Not duck owner");
        require(block.timestamp >= upgradeCooldowns[tokenId], "Upgrade cooldown active");
        require(skillStore.balanceOf(msg.sender, skillId) > 0, "Don't own skill");
        
        DuckLoadout storage loadout = duckLoadouts[tokenId];
        require(loadout.skills.length < MAX_EQUIPPED_SKILLS, "Max skills equipped");
        require(!loadout.hasSkill[skillId], "Skill already equipped");

        // Burn the skill token
        skillStore.safeTransferFrom(msg.sender, address(0xdead), skillId, 1, "");
        
        loadout.skills.push(EquippedSkill({
            skillId: skillId,
            tier: tier,
            equippedAt: block.timestamp
        }));
        loadout.hasSkill[skillId] = true;
        loadout.lastUpgrade = block.timestamp;
        
        upgradeCooldowns[tokenId] = block.timestamp + UPGRADE_COOLDOWN;
        
        emit SkillEquipped(tokenId, skillId, tier);
    }

    function unequipSkill(uint256 tokenId, uint256 skillId) external {
        require(duckNFT.ownerOf(tokenId) == msg.sender, "Not duck owner");
        
        DuckLoadout storage loadout = duckLoadouts[tokenId];
        require(loadout.hasSkill[skillId], "Skill not equipped");
        
        // Find and remove skill
        for (uint256 i = 0; i < loadout.skills.length; i++) {
            if (loadout.skills[i].skillId == skillId) {
                loadout.skills[i] = loadout.skills[loadout.skills.length - 1];
                loadout.skills.pop();
                break;
            }
        }
        
        loadout.hasSkill[skillId] = false;
        emit SkillUnequipped(tokenId, skillId);
    }

    function getDuckSkills(uint256 tokenId) external view returns (EquippedSkill[] memory) {
        return duckLoadouts[tokenId].skills;
    }

    function hasSkillEquipped(uint256 tokenId, uint256 skillId) external view returns (bool) {
        return duckLoadouts[tokenId].hasSkill[skillId];
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}