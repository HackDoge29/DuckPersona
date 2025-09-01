// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract SkillStore is ERC1155, Ownable, Pausable {
    struct Skill {
        string name;
        string description;
        uint256 priceDUCK;
        uint8 maxTier;
        bool active;
    }

    mapping(uint256 => Skill) public skills;
    mapping(uint256 => mapping(uint8 => uint256)) public tierPrices;

    IERC20 public duckToken;
    uint256 public nextSkillId = 1;

    event SkillCreated(uint256 indexed skillId, string name, uint256 price);
    event SkillPurchased(address indexed buyer, uint256 indexed skillId, uint8 tier, uint256 price);

    constructor(address _duckToken, string memory uri, address initialOwner)
        ERC1155(uri)
        Ownable(initialOwner)
    {
        duckToken = IERC20(_duckToken);
    }

    function createSkill(
        string memory name,
        string memory description,
        uint256 basePriceDUCK,
        uint8 maxTier
    ) external onlyOwner returns (uint256) {
        uint256 skillId = nextSkillId++;
        
        skills[skillId] = Skill({
            name: name,
            description: description,
            priceDUCK: basePriceDUCK,
            maxTier: maxTier,
            active: true
        });

        // Set tier prices (exponential scaling)
        for (uint8 tier = 1; tier <= maxTier; tier++) {
            tierPrices[skillId][tier] = basePriceDUCK * (2 ** (tier - 1));
        }

        emit SkillCreated(skillId, name, basePriceDUCK);
        return skillId;
    }

    function purchaseSkill(uint256 skillId, uint8 tier, uint256 amount) external whenNotPaused {
        require(skills[skillId].active, "Skill not active");
        require(tier > 0 && tier <= skills[skillId].maxTier, "Invalid tier");
        
        uint256 totalPrice = tierPrices[skillId][tier] * amount;
        require(duckToken.transferFrom(msg.sender, address(this), totalPrice), "Payment failed");
        
        _mint(msg.sender, skillId, amount, "");
        emit SkillPurchased(msg.sender, skillId, tier, totalPrice);
    }

    function setSkillActive(uint256 skillId, bool active) external onlyOwner {
        require(skillId < nextSkillId, "Skill does not exist");
        skills[skillId].active = active;
    }

    function setSkillPrice(uint256 skillId, uint8 tier, uint256 newPrice) external onlyOwner {
        require(skillId < nextSkillId, "Skill does not exist");
        require(tier > 0 && tier <= skills[skillId].maxTier, "Invalid tier");
        tierPrices[skillId][tier] = newPrice;
    }

    function withdrawDUCK() external onlyOwner {
        uint256 balance = duckToken.balanceOf(address(this));
        require(duckToken.transfer(owner(), balance), "Transfer failed");
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}