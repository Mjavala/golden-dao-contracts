// SPDX-License-Identifier: MIT
pragma solidity 0.8.2;
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/draft-ERC20PermitUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/extensions/ERC20VotesUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";



contract Maia is Initializable, UUPSUpgradeable, ERC20Upgradeable, ERC20PermitUpgradeable, ERC20VotesUpgradeable, OwnableUpgradeable, PausableUpgradeable {
    using SafeMathUpgradeable for uint256;
    IERC20 public gold;

    // Info of each user.
    struct UserInfo {
        uint256 amount;     // How many LP tokens the user has provided.
        uint256 rewardDebt; // Reward debt. See explanation below.
        uint256 rewargoldDebt; // Reward debt in GOLD.
        uint256 stakeEnd;
        //
        // We do some fancy math here. Basically, any point in time, the amount of GOLD
        // entitled to a user but is pending to be distributed is:
        //
        //   pending reward = (user.amount * pool.accGOLDPerShare) - user.rewardDebt
        //
        // Whenever a user deposits or withdraws LP tokens to a pool. Here's what happens:
        //   1. The pool's `accGOLDPerShare` (and `lastRewardBlock`) gets updated.
        //   2. User receives the pending reward sent to his/her address.
        //   3. User's `amount` gets updated.
        //   4. User's `rewardDebt` gets updated.
    }

    struct ValarUserInfo {
        uint256 rewardDebt;
    }

    // Info of each pool.
    struct PoolInfo {
        IERC20 lpToken;           // Address of LP token contract.
        uint256 allocPoint;       // How many allocation points assigned to this pool. GOLDs to distribute per block.
        uint256 lastRewardBlock;  // Last block number that GOLDs distribution occurs.
        uint256 accGOLDPerShare; // Accumulated GOLDs per share, times 1e12. See below.
        uint256 lastTotalGOLDReward; // last total rewards
        uint256 lastGOLDRewardBalance; // last GOLD rewards tokens
        uint256 totalGOLDReward; // total GOLD rewards tokens
    }

    struct ValarPoolInfo {
        uint256 lastGOLDRewardBalance;
        uint256 totalGOLDReward;
        uint256 totalValar;
    }

    // The GOLD TOKEN!
    IERC20 public GOLD;
    IERC20 public Valar;
    // admin address.
    address public adminAddress;
    // Bonus muliplier for early GOLD makers.
    uint256 public constant BONUS_MULTIPLIER = 1;

    // Number of top staker stored

    uint256 public topStakerNumber;

    // Info of each pool.
    PoolInfo[] public poolInfo;
    ValarPoolInfo[] public valarPoolInfo;
    // Info of each user that stakes LP tokens.
    mapping (uint256 => mapping (address => UserInfo)) public userInfo;
    mapping (uint256 => mapping (address => ValarUserInfo)) public valarUserInfo;


    // Total allocation points. Must be the sum of all allocation points in all pools.
    uint256 public totalAllocPoint;
    // The block number when reward distribution start.
    uint256 public startBlock;
    // total GOLD staked
    uint256 public totalGOLDStaked;
    // total GOLD used for purchase land
    uint256 public totalGOLDUsedForPurchase;

    event Deposit(address indexed user, uint256 indexed pid, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount);
    event AdminUpdated(address newAdmin);

    function initialize(        
        address _GOLD,
        address _Valar,
        address _adminAddress,
        uint256 _startBlock,
        uint256 _topStakerNumber
        ) public initializer {
        require(_adminAddress != address(0), "initialize: Zero address");
        OwnableUpgradeable.__Ownable_init();
        __ERC20_init_unchained("gold", "gold");
        __Pausable_init_unchained();
        ERC20PermitUpgradeable.__ERC20Permit_init("gold");
        ERC20VotesUpgradeable.__ERC20Votes_init_unchained();
        GOLD = IERC20(_GOLD);
        Valar = IERC20(_Valar);
        adminAddress = _adminAddress;
        startBlock = _startBlock;
        topStakerNumber = _topStakerNumber;
    }

    function poolLength() external view returns (uint256) {
        return poolInfo.length;
    }

    // Add a new lp to the pool. Can only be called by the owner.
    // XXX DO NOT add the same LP token more than once. Rewards will be messed up if you do.
    function add(uint256 _allocPoint, IERC20 _lpToken, bool _withUpdate) public onlyOwner {
        if (_withUpdate) {
            massUpdatePools();
        }
        uint256 lastRewardBlock = block.number > startBlock ? block.number : startBlock;
        totalAllocPoint = totalAllocPoint.add(_allocPoint);
        poolInfo.push(PoolInfo({
            lpToken: _lpToken,
            allocPoint: _allocPoint,
            lastRewardBlock: lastRewardBlock,
            accGOLDPerShare: 0,
            lastTotalGOLDReward: 0,
            lastGOLDRewardBalance: 0,
            totalGOLDReward: 0
        }));
        /**
            struct ValarPoolInfo {
                uint256 lastGOLDRewardBalance;
                uint256 totalGOLDReward;
                uint256 totalValar;
            }
         */
         valarPoolInfo.push(ValarPoolInfo({
             lastGOLDRewardBalance: 0,
             totalGOLDReward: 0,
             totalValar: 0
         }));

    }

    // Update the given pool's GOLD allocation point. Can only be called by the owner.
    function set(uint256 _pid, uint256 _allocPoint, bool _withUpdate) public onlyOwner {
        if (_withUpdate) {
            massUpdatePools();
        }
        totalAllocPoint = totalAllocPoint.sub(poolInfo[_pid].allocPoint).add(_allocPoint);
        poolInfo[_pid].allocPoint = _allocPoint;
    }
    
    // Return reward multiplier over the given _from to _to block.
    function getMultiplier(uint256 _from, uint256 _to) public pure returns (uint256) {
        if (_to >= _from) {
            return _to.sub(_from).mul(BONUS_MULTIPLIER);
        } else {
            return _from.sub(_to);
        }
    }
    
    // View function to see pending GOLDs on frontend.
    function pendingGOLD(uint256 _pid, address _user) external view returns (uint256) {
        PoolInfo storage pool = poolInfo[_pid];
        ValarPoolInfo storage vpool = valarPoolInfo[_pid];
        UserInfo storage user = userInfo[_pid][_user];
        ValarUserInfo storage vala = valarUserInfo[_pid][_user];

        uint256 accGOLDPerShare = pool.accGOLDPerShare;
        uint256 lpSupply = totalGOLDStaked;
        uint256 valarReward;
        if (block.number > pool.lastRewardBlock && lpSupply != 0) {
            uint256 rewardBalance = pool.lpToken.balanceOf(address(this)).sub(totalGOLDStaked.sub(totalGOLDUsedForPurchase)).mul(90).div(100);
            uint256 _totalReward = rewardBalance.sub(pool.lastGOLDRewardBalance);
            accGOLDPerShare = accGOLDPerShare.add(_totalReward.mul(1e12).div(lpSupply));
            if (Valar.balanceOf(_user) > 0) {
                uint256 rewardPerVala = vpool.totalGOLDReward.div(vpool.totalValar);

                valarReward = rewardPerVala.sub(vala.rewardDebt);
            }
        }
        return user.amount.mul(accGOLDPerShare).div(1e12).sub(user.rewargoldDebt).add(valarReward);
    }

    // Update reward variables for all pools. Be careful of gas spending!
    function massUpdatePools() public {
        uint256 length = poolInfo.length;
        for (uint256 pid = 0; pid < length; ++pid) {
            updatePool(pid);
        }
    }

    function updatePoolHelper(uint _pid) external view returns (uint) {
        PoolInfo storage pool = poolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        
        if (block.number <= pool.lastRewardBlock) {
            return 0;
        }
        uint256 rewardBalance = pool.lpToken.balanceOf(address(this)).sub(totalGOLDStaked.sub(totalGOLDUsedForPurchase));

        return rewardBalance;
    }

    // Update reward variables of the given pool to be up-to-date.
    function updatePool(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        ValarPoolInfo storage vpool = valarPoolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        ValarUserInfo storage vala = valarUserInfo[_pid][msg.sender];

        
        if (block.number <= pool.lastRewardBlock) {
            return;
        }
        uint256 rewardBalance = pool.lpToken.balanceOf(address(this)).sub(totalGOLDStaked.sub(totalGOLDUsedForPurchase)).mul(90).div(100);
        uint256 _totalReward = pool.totalGOLDReward.add(rewardBalance.sub(pool.lastGOLDRewardBalance));
        pool.lastGOLDRewardBalance = rewardBalance;
        pool.totalGOLDReward = _totalReward;

        uint256 valarRewardBalance = pool.lpToken.balanceOf(address(this)).sub(totalGOLDStaked.sub(totalGOLDUsedForPurchase)).mul(10).div(100);
        uint256 _totalValarReward = vpool.totalGOLDReward.add(valarRewardBalance.sub(vpool.lastGOLDRewardBalance));
        vpool.lastGOLDRewardBalance = valarRewardBalance;
        vpool.totalGOLDReward = _totalValarReward;

        vpool.totalValar = Valar.totalSupply();
        
        uint256 lpSupply = totalGOLDStaked;
        if (lpSupply == 0) {
            pool.lastRewardBlock = block.number;
            pool.accGOLDPerShare = 0;
            pool.lastTotalGOLDReward = 0;
            user.rewargoldDebt = 0;
            pool.lastGOLDRewardBalance = 0;
            pool.totalGOLDReward = 0;
            vpool.totalGOLDReward = 0;
            vpool.lastGOLDRewardBalance = 0;
            vala.rewardDebt = 0;
            return;
        }
        
        uint256 reward = _totalReward.sub(pool.lastTotalGOLDReward);
        pool.accGOLDPerShare = pool.accGOLDPerShare.add(reward.mul(1e12).div(lpSupply));
        pool.lastTotalGOLDReward = _totalReward;
    }

    // Deposit GOLD tokens to MasterChef.
    function deposit(uint256 _pid, uint256 _amount) public {
        PoolInfo storage pool = poolInfo[_pid];
        ValarPoolInfo storage vpool = valarPoolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        ValarUserInfo storage vala = valarUserInfo[_pid][msg.sender];

        updatePool(_pid);
        if (user.amount > 0) {
            uint256 valarRewrds = valarRewards(_pid, msg.sender);
            uint256 GOLDReward = user.amount.mul(pool.accGOLDPerShare).div(1e12).sub(user.rewargoldDebt);
            pool.lpToken.transfer(msg.sender, GOLDReward.add(valarRewrds));
            pool.lastGOLDRewardBalance = pool.lpToken.balanceOf(address(this)).sub(totalGOLDStaked.sub(totalGOLDUsedForPurchase)).mul(90).div(100);
            vpool.lastGOLDRewardBalance = pool.lpToken.balanceOf(address(this)).sub(totalGOLDStaked.sub(totalGOLDUsedForPurchase)).mul(10).div(100);
        }
        uint256 taxAdjustedAmount = _amount.sub(_amount.mul(4).div(100));

        pool.lpToken.transferFrom(address(msg.sender), address(this), _amount);
        totalGOLDStaked = totalGOLDStaked.add(taxAdjustedAmount);
        user.amount = user.amount.add(taxAdjustedAmount);
        user.rewargoldDebt = user.amount.mul(pool.accGOLDPerShare).div(1e12);
        user.stakeEnd = block.timestamp + 7 days;
        _mint(msg.sender,taxAdjustedAmount);
        emit Deposit(msg.sender, _pid, taxAdjustedAmount);
    }

    function getVPOOL(uint _pid) external view returns(ValarPoolInfo memory) {
        return valarPoolInfo[_pid];
    }

    function withdraw(uint256 _pid, uint256 _amount) public {
        PoolInfo storage pool = poolInfo[_pid];
        ValarPoolInfo storage vpool = valarPoolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        ValarUserInfo storage vala = valarUserInfo[_pid][msg.sender];

        uint256 taxAdjustedAmount = _amount - _amount.mul(4).div(100);

        require(user.amount >= taxAdjustedAmount, "withdraw: not good");
        require(block.timestamp >= user.stakeEnd, "withdraw: too soon");
        updatePool(_pid);

        uint256 valarRewrds = valarRewards(_pid, msg.sender);
        uint256 GOLDReward = user.amount.mul(pool.accGOLDPerShare).div(1e12).sub(user.rewargoldDebt);
        if (GOLDReward > 0 || valarRewrds > 0) pool.lpToken.transfer(msg.sender, GOLDReward.add(valarRewrds));
        pool.lastGOLDRewardBalance = pool.lpToken.balanceOf(address(this)).sub(totalGOLDStaked.sub(totalGOLDUsedForPurchase)).mul(90).div(100);
        vpool.lastGOLDRewardBalance = pool.lpToken.balanceOf(address(this)).sub(totalGOLDStaked.sub(totalGOLDUsedForPurchase)).mul(10).div(100);

        user.amount = user.amount.sub(taxAdjustedAmount);
        totalGOLDStaked = totalGOLDStaked.sub(taxAdjustedAmount);
        user.rewargoldDebt = user.amount.mul(pool.accGOLDPerShare).div(1e12);
        pool.lpToken.transfer(address(msg.sender), taxAdjustedAmount);
        _burn(msg.sender,taxAdjustedAmount);
        emit Withdraw(msg.sender, _pid, taxAdjustedAmount);
    }

    function getPool(uint256 _pid) external view returns (PoolInfo memory) {
        return poolInfo[_pid]; 
    }

    function getUser(uint256 _pid, address _user) external view returns (UserInfo memory) {
        return userInfo[_pid][_user]; 
    }

    function valarRewards(uint256 _pid, address _user) public returns (uint256) {
        if (Valar.balanceOf(_user) == 0) return 0;
        ValarPoolInfo storage vpool = valarPoolInfo[_pid];
        ValarUserInfo storage vala = valarUserInfo[_pid][msg.sender];

        if (vpool.totalValar == 0) return 0;

        uint256 rewardPerVala = vpool.totalGOLDReward.div(vpool.totalValar);

        uint256 adjustedReward = rewardPerVala.sub(vala.rewardDebt);

        vala.rewardDebt = adjustedReward;

        return adjustedReward;
    }
    
    // Earn GOLD tokens to MasterChef.
    function claimGOLD(uint256 _pid) public {
        PoolInfo storage pool = poolInfo[_pid];
        ValarPoolInfo storage vpool = valarPoolInfo[_pid];
        UserInfo storage user = userInfo[_pid][msg.sender];
        ValarUserInfo storage vala = valarUserInfo[_pid][msg.sender];

        updatePool(_pid);
        
        uint256 GOLDReward = user.amount.mul(pool.accGOLDPerShare).div(1e12).sub(user.rewargoldDebt);
        uint256 valarReward = valarRewards(_pid, msg.sender);
        if (GOLDReward > 0 || valarReward > 0) pool.lpToken.transfer(msg.sender, GOLDReward.add(valarReward));
        pool.lastGOLDRewardBalance = pool.lpToken.balanceOf(address(this)).sub(totalGOLDStaked.sub(totalGOLDUsedForPurchase)).mul(90).div(100);
        vpool.lastGOLDRewardBalance = pool.lpToken.balanceOf(address(this)).sub(totalGOLDStaked.sub(totalGOLDUsedForPurchase)).mul(10).div(100);

        user.rewargoldDebt = user.amount.mul(pool.accGOLDPerShare).div(1e12);
    }
    
    // Safe GOLD transfer function to admin.
    function accessGOLDTokens(uint256 _pid, address _to, uint256 _amount) public {
        require(msg.sender == adminAddress, "sender must be admin address");
        require(totalGOLDStaked.sub(totalGOLDUsedForPurchase) >= _amount, "Amount must be less than staked GOLD amount");
        PoolInfo storage pool = poolInfo[_pid];
        uint256 GOLDBal = pool.lpToken.balanceOf(address(this));
        if (_amount > GOLDBal) {
            pool.lpToken.transfer(_to, GOLDBal);
            totalGOLDUsedForPurchase = totalGOLDUsedForPurchase.add(GOLDBal);
            emit EmergencyWithdraw(_to, _pid, GOLDBal);
        } else {
            pool.lpToken.transfer(_to, _amount);
            totalGOLDUsedForPurchase = totalGOLDUsedForPurchase.add(_amount);
            emit EmergencyWithdraw(_to, _pid, _amount);
        }
    }
    // Update admin address by the previous admin.
    function admin(address _adminAddress) public {
        require(_adminAddress != address(0), "admin: Zero address");
        require(msg.sender == adminAddress, "admin: wut?");
        adminAddress = _adminAddress;
        emit AdminUpdated(_adminAddress);
    }

    function _mint(address to, uint256 amount)
        internal
        override(ERC20Upgradeable, ERC20VotesUpgradeable)
    {
        super._mint(to, amount);
    }

    function _burn(address account, uint256 amount)
        internal
        override(ERC20Upgradeable, ERC20VotesUpgradeable)
    {
        super._burn(account, amount);
    }

    function _afterTokenTransfer(address from, address to, uint256 amount)
        internal
        override(ERC20Upgradeable, ERC20VotesUpgradeable)
    {
        ERC20VotesUpgradeable._afterTokenTransfer(from, to, amount);
    }

    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal virtual override {
        
        if(from == address(0) || to == address(0)){
            super._beforeTokenTransfer(from, to, amount);
        }else{
            revert("Non transferable token");
        }
    }

    function _delegate(address delegator, address delegatee) internal virtual override {
        super._delegate(delegator,delegatee);
    }

    function _authorizeUpgrade(address) internal view override {
        require(owner() == msg.sender, "Only owner can upgrade implementation");
    }



}