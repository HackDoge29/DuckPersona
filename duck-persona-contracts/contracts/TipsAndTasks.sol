// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./DuckNFT.sol";

contract TipsAndTasks is Ownable, Pausable, ReentrancyGuard {
    struct Task {
        bytes32 taskHash;
        address creator;
        uint256 rewardDUCK;
        uint256 deadline;
        bool completed;
        uint256 claimedBy; // tokenId of duck that completed it
        string description;
    }

    mapping(bytes32 => Task) public tasks;
    mapping(uint256 => uint256) public duckEarnings; // tokenId => total earnings
    mapping(uint256 => uint256) public tipBalances; // tokenId => tip balance
    
    DuckNFT public duckNFT;
    IERC20 public duckToken;
    
    uint256 public taskCounter;
    uint256 public constant MIN_TASK_REWARD = 10 * 10**18; // 10 DUCK minimum

    event TaskCreated(bytes32 indexed taskHash, address indexed creator, uint256 reward);
    event TaskCompleted(bytes32 indexed taskHash, uint256 indexed tokenId, uint256 reward);
    event TipSent(uint256 indexed fromTokenId, uint256 indexed toTokenId, uint256 amount);

    constructor(address _duckNFT, address _duckToken, address initialOwner)
        Ownable(initialOwner)
    {
        duckNFT = DuckNFT(_duckNFT);
        duckToken = IERC20(_duckToken);
    }

    function createTask(
        string memory description,
        uint256 rewardDUCK,
        uint256 durationHours
    ) external whenNotPaused returns (bytes32) {
        require(rewardDUCK >= MIN_TASK_REWARD, "Reward too low");
        require(duckToken.transferFrom(msg.sender, address(this), rewardDUCK), "Payment failed");
        
        taskCounter++;
        bytes32 taskHash = keccak256(abi.encodePacked(description, taskCounter, block.timestamp));
        
        tasks[taskHash] = Task({
            taskHash: taskHash,
            creator: msg.sender,
            rewardDUCK: rewardDUCK,
            deadline: block.timestamp + (durationHours * 1 hours),
            completed: false,
            claimedBy: 0,
            description: description
        });

        emit TaskCreated(taskHash, msg.sender, rewardDUCK);
        return taskHash;
    }

    function completeTask(
        bytes32 taskHash,
        uint256 tokenId,
        bytes32 proofHash
    ) external whenNotPaused nonReentrant {
        Task storage task = tasks[taskHash];
        require(!task.completed, "Task already completed");
        require(block.timestamp <= task.deadline, "Task expired");
        require(duckNFT.ownerOf(tokenId) == msg.sender, "Not duck owner");
        
        // In a real implementation, you'd verify the proof
        // For now, we just check that a proof was provided
        require(proofHash != bytes32(0), "Invalid proof");
        
        task.completed = true;
        task.claimedBy = tokenId;
        
        duckEarnings[tokenId] += task.rewardDUCK;
        require(duckToken.transfer(msg.sender, task.rewardDUCK), "Reward transfer failed");
        
        // Give XP to the duck
        duckNFT.addXP(tokenId, 100);
        
        emit TaskCompleted(taskHash, tokenId, task.rewardDUCK);
    }

    function tipDuck(uint256 fromTokenId, uint256 toTokenId, uint256 amount) external whenNotPaused {
        require(duckNFT.ownerOf(fromTokenId) == msg.sender, "Not duck owner");
        require(duckNFT.ownerOf(toTokenId) != address(0), "Target duck doesn't exist");
        require(amount > 0, "Amount must be positive");
        
        require(duckToken.transferFrom(msg.sender, address(this), amount), "Payment failed");
        
        tipBalances[toTokenId] += amount;
        duckEarnings[toTokenId] += amount;
        
        emit TipSent(fromTokenId, toTokenId, amount);
    }

    function claimTips(uint256 tokenId) external nonReentrant {
        require(duckNFT.ownerOf(tokenId) == msg.sender, "Not duck owner");
        
        uint256 balance = tipBalances[tokenId];
        require(balance > 0, "No tips to claim");
        
        tipBalances[tokenId] = 0;
        require(duckToken.transfer(msg.sender, balance), "Transfer failed");
    }

    function getActiveTasksCount() external view returns (uint256) {
        return taskCounter;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}