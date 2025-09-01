// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract DuckNFT is ERC721, Ownable, Pausable, ReentrancyGuard {
    uint256 private _tokenIds;

    struct DuckTraits {
        uint8 rarity;
        uint8 species;
        uint8 color;
        uint8 personality;
        uint256 level;
        uint256 xp;
        uint256 mintTimestamp;
        string customName;
    }

    mapping(uint256 => DuckTraits) public duckTraits;
    mapping(uint256 => string) private _tokenURIs;
    mapping(address => bool) public authorizedOrchestrators;

    string private _baseTokenURI;
    uint256 public constant MINT_PRICE = 0.01 ether;
    uint256 public constant MAX_SUPPLY = 10000;

    event DuckMinted(uint256 indexed tokenId, address indexed owner, uint8 rarity);
    event DuckUpgraded(uint256 indexed tokenId, uint256 newLevel, uint256 newXp);
    event OrchestratorUpdated(address indexed orchestrator, bool authorized);

    modifier onlyOrchestrator() {
        require(authorizedOrchestrators[msg.sender] || msg.sender == owner(), "Not authorized");
        _;
    }

    constructor(string memory baseURI, address initialOwner) ERC721("DuckPersona", "DUCK") Ownable(initialOwner) {
        _baseTokenURI = baseURI;
    }

    function mintDuck(address to, uint256 seed) external payable whenNotPaused nonReentrant returns (uint256) {
        require(msg.value >= MINT_PRICE, "Insufficient payment");
        require(_tokenIds < MAX_SUPPLY, "Max supply reached");
        
        _tokenIds++;
        uint256 tokenId = _tokenIds;
        
        // Generate deterministic traits from seed
        DuckTraits memory traits = _generateTraits(seed, tokenId);
        duckTraits[tokenId] = traits;
        
        _mint(to, tokenId);
        emit DuckMinted(tokenId, to, traits.rarity);
        
        return tokenId;
    }

    function _generateTraits(uint256 seed, uint256 tokenId) internal view returns (DuckTraits memory) {
        uint256 randomness = uint256(keccak256(abi.encodePacked(seed, tokenId, block.timestamp)));
        
        uint8 rarity = _determineRarity(randomness);
        
        return DuckTraits({
            rarity: rarity,
            species: uint8((randomness >> 8) % 10) + 1,
            color: uint8((randomness >> 16) % 20) + 1,
            personality: uint8((randomness >> 24) % 8) + 1,
            level: 1,
            xp: 0,
            mintTimestamp: block.timestamp,
            customName: ""
        });
    }

    function _determineRarity(uint256 randomness) internal pure returns (uint8) {
        uint256 roll = randomness % 10000;
        if (roll < 5000) return 1; // Common (50%)
        if (roll < 8000) return 2; // Uncommon (30%)
        if (roll < 9500) return 3; // Rare (15%)
        if (roll < 9900) return 4; // Epic (4%)
        return 5; // Legendary (1%)
    }

    function setTokenURI(uint256 tokenId, string memory newURI) external onlyOrchestrator {
        require(_exists(tokenId), "Token does not exist");
        _tokenURIs[tokenId] = newURI;
    }

    function setCustomName(uint256 tokenId, string memory name) external {
        require(ownerOf(tokenId) == msg.sender, "Not token owner");
        require(bytes(name).length <= 32, "Name too long");
        duckTraits[tokenId].customName = name;
    }

    function addXP(uint256 tokenId, uint256 xpAmount) external onlyOrchestrator {
        require(_exists(tokenId), "Token does not exist");
        DuckTraits storage traits = duckTraits[tokenId];
        traits.xp += xpAmount;
        
        // Level up logic
        uint256 xpRequired = traits.level * 1000;
        if (traits.xp >= xpRequired) {
            traits.level++;
            emit DuckUpgraded(tokenId, traits.level, traits.xp);
        }
    }

    function setOrchestratorAuth(address orchestrator, bool authorized) external onlyOwner {
        authorizedOrchestrators[orchestrator] = authorized;
        emit OrchestratorUpdated(orchestrator, authorized);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "Token does not exist");
        
        string memory customURI = _tokenURIs[tokenId];
        if (bytes(customURI).length > 0) {
            return customURI;
        }
        
        return string(abi.encodePacked(_baseTokenURI, Strings.toString(tokenId)));
    }

    function totalSupply() public view returns (uint256) {
        return _tokenIds;
    }

    function withdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // Override _exists since it's internal in newer OpenZeppelin versions
    function _exists(uint256 tokenId) internal view returns (bool) {
        return tokenId > 0 && tokenId <= _tokenIds;
    }
}