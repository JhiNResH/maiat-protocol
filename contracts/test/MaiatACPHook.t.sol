// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console2} from "forge-std/Test.sol";
import {
    MaiatACPHook,
    IACPHook,
    ITrustOracle,
    IAgenticCommerceReader,
    MaiatACPHook__ClientTrustTooLow,
    MaiatACPHook__ProviderTrustTooLow,
    MaiatACPHook__ClientNotInitialized,
    MaiatACPHook__ZeroAddress,
    MaiatACPHook__ThresholdOutOfRange
} from "../src/MaiatACPHook.sol";
import {IERC165} from "openzeppelin-contracts/contracts/utils/introspection/IERC165.sol";

/*//////////////////////////////////////////////////////////////
                    MOCK: TrustOracle
//////////////////////////////////////////////////////////////*/

contract MockTrustOracle is ITrustOracle {
    mapping(address => UserReputation) public reps;

    function setUserData(address user, uint256 score, bool initialized) external {
        reps[user] = UserReputation({
            reputationScore: score,
            totalReviews: 1,
            scarabPoints: 0,
            feeBps: 50,
            initialized: initialized,
            lastUpdated: block.timestamp
        });
    }

    function getUserData(address user) external view returns (UserReputation memory) {
        return reps[user];
    }
}

/*//////////////////////////////////////////////////////////////
                    MOCK: AgenticCommerce Reader
//////////////////////////////////////////////////////////////*/

contract MockACPReader is IAgenticCommerceReader {
    mapping(uint256 => Job) public jobs;
    uint256 public nextJobId;

    function createMockJob(
        address client,
        address provider
    ) external returns (uint256 jobId) {
        jobId = nextJobId++;
        jobs[jobId] = Job({
            id: jobId,
            client: client,
            provider: provider,
            evaluator: address(0),
            description: "test job",
            budget: 1 ether,
            expiredAt: block.timestamp + 7 days,
            status: 2, // Submitted
            hook: address(0)
        });
    }

    function getJob(uint256 jobId) external view returns (Job memory) {
        return jobs[jobId];
    }
}

/*//////////////////////////////////////////////////////////////
                    UNIT TESTS
//////////////////////////////////////////////////////////////*/

contract MaiatACPHookTest is Test {
    MaiatACPHook public hook;
    MockTrustOracle public oracle;
    MockACPReader public acpReader;

    address public owner = makeAddr("owner");
    address public client = makeAddr("client");
    address public provider = makeAddr("provider");
    address public attacker = makeAddr("attacker");

    uint256 public constant CLIENT_THRESHOLD = 30;
    uint256 public constant PROVIDER_THRESHOLD = 20;

    bytes4 public FUND_SELECTOR;
    bytes4 public SUBMIT_SELECTOR;
    bytes4 public COMPLETE_SELECTOR;
    bytes4 public REJECT_SELECTOR;

    event FundGated(uint256 indexed jobId, address indexed client, uint256 score, bool allowed);
    event SubmitChecked(uint256 indexed jobId, address indexed provider, uint256 score, bool allowed);
    event JobOutcomeRecorded(
        uint256 indexed jobId,
        address indexed provider,
        address indexed client,
        bool completed,
        uint256 providerScore,
        uint256 clientScore
    );
    event ThresholdsUpdated(uint256 clientThreshold, uint256 providerThreshold);
    event OracleUpdated(address indexed oldOracle, address indexed newOracle);
    event ACPContractUpdated(address indexed oldAcp, address indexed newAcp);

    function setUp() public {
        oracle = new MockTrustOracle();
        acpReader = new MockACPReader();

        hook = new MaiatACPHook(
            address(oracle),
            address(acpReader),
            CLIENT_THRESHOLD,
            PROVIDER_THRESHOLD,
            true, // allowUninitialized
            owner
        );

        FUND_SELECTOR = hook.FUND_SELECTOR();
        SUBMIT_SELECTOR = hook.SUBMIT_SELECTOR();
        COMPLETE_SELECTOR = hook.COMPLETE_SELECTOR();
        REJECT_SELECTOR = hook.REJECT_SELECTOR();
    }

    /*//////////////////////////////////////////////////////////////
                        CONSTRUCTOR TESTS
    //////////////////////////////////////////////////////////////*/

    function test_constructor_setsStateCorrectly() public view {
        assertEq(address(hook.oracle()), address(oracle));
        assertEq(address(hook.acpContract()), address(acpReader));
        assertEq(hook.clientThreshold(), CLIENT_THRESHOLD);
        assertEq(hook.providerThreshold(), PROVIDER_THRESHOLD);
        assertTrue(hook.allowUninitialized());
        assertEq(hook.owner(), owner);
    }

    function test_constructor_revertsZeroOracle() public {
        vm.expectRevert(MaiatACPHook__ZeroAddress.selector);
        new MaiatACPHook(address(0), address(acpReader), 30, 20, true, owner);
    }

    function test_constructor_revertsZeroACP() public {
        vm.expectRevert(MaiatACPHook__ZeroAddress.selector);
        new MaiatACPHook(address(oracle), address(0), 30, 20, true, owner);
    }

    function test_constructor_revertsClientThresholdTooHigh() public {
        vm.expectRevert(abi.encodeWithSelector(MaiatACPHook__ThresholdOutOfRange.selector, 101));
        new MaiatACPHook(address(oracle), address(acpReader), 101, 20, true, owner);
    }

    function test_constructor_revertsProviderThresholdTooHigh() public {
        vm.expectRevert(abi.encodeWithSelector(MaiatACPHook__ThresholdOutOfRange.selector, 101));
        new MaiatACPHook(address(oracle), address(acpReader), 30, 101, true, owner);
    }

    /*//////////////////////////////////////////////////////////////
                    BEFORE ACTION: FUND (CLIENT CHECK)
    //////////////////////////////////////////////////////////////*/

    function test_beforeAction_fund_passesWithTrustedClient() public {
        oracle.setUserData(client, 80, true);
        bytes memory data = abi.encode(client, bytes(""));

        vm.expectEmit(true, true, false, true);
        emit FundGated(0, client, 80, true);

        hook.beforeAction(0, FUND_SELECTOR, data);
        assertEq(hook.totalFundGated(), 1);
    }

    function test_beforeAction_fund_revertsLowTrustClient() public {
        oracle.setUserData(client, 10, true);
        bytes memory data = abi.encode(client, bytes(""));

        vm.expectEmit(true, true, false, true);
        emit FundGated(0, client, 10, false);

        vm.expectRevert(
            abi.encodeWithSelector(
                MaiatACPHook__ClientTrustTooLow.selector,
                0, client, 10, CLIENT_THRESHOLD
            )
        );
        hook.beforeAction(0, FUND_SELECTOR, data);
    }

    function test_beforeAction_fund_revertsUninitializedClientWhenNotAllowed() public {
        // Deploy hook with allowUninitialized = false
        MaiatACPHook strictHook = new MaiatACPHook(
            address(oracle), address(acpReader), CLIENT_THRESHOLD, PROVIDER_THRESHOLD, false, owner
        );
        bytes memory data = abi.encode(client, bytes(""));

        vm.expectRevert(
            abi.encodeWithSelector(MaiatACPHook__ClientNotInitialized.selector, 0, client)
        );
        strictHook.beforeAction(0, FUND_SELECTOR, data);
    }

    function test_beforeAction_fund_allowsUninitializedClientWhenAllowed() public {
        // client not in oracle (uninitialized)
        bytes memory data = abi.encode(client, bytes(""));

        vm.expectEmit(true, true, false, true);
        emit FundGated(0, client, 0, true);

        hook.beforeAction(0, FUND_SELECTOR, data);
        assertEq(hook.totalFundGated(), 1);
    }

    function test_beforeAction_fund_revertsAndEmitsFalseEvent() public {
        oracle.setUserData(client, 5, true);
        bytes memory data = abi.encode(client, bytes(""));

        vm.expectRevert(
            abi.encodeWithSelector(
                MaiatACPHook__ClientTrustTooLow.selector,
                0, client, 5, CLIENT_THRESHOLD
            )
        );
        hook.beforeAction(0, FUND_SELECTOR, data);
    }

    function test_beforeAction_fund_clientExactlyAtThreshold() public {
        oracle.setUserData(client, CLIENT_THRESHOLD, true);
        bytes memory data = abi.encode(client, bytes(""));

        hook.beforeAction(0, FUND_SELECTOR, data);
        assertEq(hook.totalFundGated(), 1);
    }

    /*//////////////////////////////////////////////////////////////
                    BEFORE ACTION: SUBMIT (PROVIDER CHECK)
    //////////////////////////////////////////////////////////////*/

    function test_beforeAction_submit_passesWithTrustedProvider() public {
        oracle.setUserData(provider, 60, true);
        bytes memory data = abi.encode(provider, bytes32(0), bytes(""));

        vm.expectEmit(true, true, false, true);
        emit SubmitChecked(0, provider, 60, true);

        hook.beforeAction(0, SUBMIT_SELECTOR, data);
    }

    function test_beforeAction_submit_revertsLowTrustProvider() public {
        oracle.setUserData(provider, 5, true);
        bytes memory data = abi.encode(provider, bytes32(0), bytes(""));

        vm.expectRevert(
            abi.encodeWithSelector(
                MaiatACPHook__ProviderTrustTooLow.selector,
                0, provider, 5, PROVIDER_THRESHOLD
            )
        );
        hook.beforeAction(0, SUBMIT_SELECTOR, data);
    }

    function test_beforeAction_submit_allowsUninitializedProvider() public {
        // provider not in oracle
        bytes memory data = abi.encode(provider, bytes32(0), bytes(""));

        vm.expectEmit(true, true, false, true);
        emit SubmitChecked(0, provider, 0, true);

        hook.beforeAction(0, SUBMIT_SELECTOR, data);
    }

    /*//////////////////////////////////////////////////////////////
                    BEFORE ACTION: PASS-THROUGH
    //////////////////////////////////////////////////////////////*/

    function test_beforeAction_passThroughOtherSelectors() public {
        bytes4 randomSelector = bytes4(keccak256("doSomething()"));
        bytes memory data = abi.encode(client, bytes(""));

        // Should not revert
        hook.beforeAction(0, randomSelector, data);
        assertEq(hook.totalFundGated(), 0);
    }

    /*//////////////////////////////////////////////////////////////
                    AFTER ACTION: COMPLETE
    //////////////////////////////////////////////////////////////*/

    function test_afterAction_complete_recordsOutcome() public {
        uint256 jobId = acpReader.createMockJob(client, provider);
        oracle.setUserData(provider, 80, true);
        oracle.setUserData(client, 70, true);

        vm.expectEmit(true, true, true, true);
        emit JobOutcomeRecorded(jobId, provider, client, true, 80, 70);

        hook.afterAction(jobId, COMPLETE_SELECTOR, bytes(""));
        assertEq(hook.totalCompleted(), 1);
    }

    function test_afterAction_reject_recordsOutcome() public {
        uint256 jobId = acpReader.createMockJob(client, provider);
        oracle.setUserData(provider, 80, true);
        oracle.setUserData(client, 70, true);

        vm.expectEmit(true, true, true, true);
        emit JobOutcomeRecorded(jobId, provider, client, false, 80, 70);

        hook.afterAction(jobId, REJECT_SELECTOR, bytes(""));
        assertEq(hook.totalRejected(), 1);
    }

    function test_afterAction_noopForOtherSelectors() public {
        bytes4 randomSelector = bytes4(keccak256("doSomething()"));
        hook.afterAction(0, randomSelector, bytes(""));
        assertEq(hook.totalCompleted(), 0);
        assertEq(hook.totalRejected(), 0);
    }

    /*//////////////////////////////////////////////////////////////
                    SUPPORTS INTERFACE
    //////////////////////////////////////////////////////////////*/

    function test_supportsInterface_IACPHook() public view {
        assertTrue(hook.supportsInterface(type(IACPHook).interfaceId));
    }

    function test_supportsInterface_IERC165() public view {
        assertTrue(hook.supportsInterface(type(IERC165).interfaceId));
    }

    function test_supportsInterface_randomReturnsFalse() public view {
        assertFalse(hook.supportsInterface(bytes4(0xdeadbeef)));
    }

    /*//////////////////////////////////////////////////////////////
                    ADMIN: SET THRESHOLDS
    //////////////////////////////////////////////////////////////*/

    function test_setThresholds_works() public {
        vm.prank(owner);

        vm.expectEmit(false, false, false, true);
        emit ThresholdsUpdated(50, 40);

        hook.setThresholds(50, 40);
        assertEq(hook.clientThreshold(), 50);
        assertEq(hook.providerThreshold(), 40);
    }

    function test_setThresholds_revertsNonOwner() public {
        vm.prank(attacker);
        vm.expectRevert();
        hook.setThresholds(50, 40);
    }

    function test_setThresholds_revertsClientTooHigh() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(MaiatACPHook__ThresholdOutOfRange.selector, 101));
        hook.setThresholds(101, 40);
    }

    function test_setThresholds_revertsProviderTooHigh() public {
        vm.prank(owner);
        vm.expectRevert(abi.encodeWithSelector(MaiatACPHook__ThresholdOutOfRange.selector, 101));
        hook.setThresholds(50, 101);
    }

    function test_setThresholds_allowsZero() public {
        vm.prank(owner);
        hook.setThresholds(0, 0);
        assertEq(hook.clientThreshold(), 0);
        assertEq(hook.providerThreshold(), 0);
    }

    function test_setThresholds_allows100() public {
        vm.prank(owner);
        hook.setThresholds(100, 100);
        assertEq(hook.clientThreshold(), 100);
        assertEq(hook.providerThreshold(), 100);
    }

    /*//////////////////////////////////////////////////////////////
                    ADMIN: SET ORACLE
    //////////////////////////////////////////////////////////////*/

    function test_setOracle_works() public {
        address newOracle = makeAddr("newOracle");
        vm.prank(owner);

        vm.expectEmit(true, true, false, true);
        emit OracleUpdated(address(oracle), newOracle);

        hook.setOracle(newOracle);
        assertEq(address(hook.oracle()), newOracle);
    }

    function test_setOracle_revertsNonOwner() public {
        vm.prank(attacker);
        vm.expectRevert();
        hook.setOracle(makeAddr("newOracle"));
    }

    function test_setOracle_revertsZero() public {
        vm.prank(owner);
        vm.expectRevert(MaiatACPHook__ZeroAddress.selector);
        hook.setOracle(address(0));
    }

    /*//////////////////////////////////////////////////////////////
                    ADMIN: SET ACP CONTRACT
    //////////////////////////////////////////////////////////////*/

    function test_setACPContract_works() public {
        address newACP = makeAddr("newACP");
        vm.prank(owner);

        vm.expectEmit(true, true, false, true);
        emit ACPContractUpdated(address(acpReader), newACP);

        hook.setACPContract(newACP);
        assertEq(address(hook.acpContract()), newACP);
    }

    function test_setACPContract_revertsNonOwner() public {
        vm.prank(attacker);
        vm.expectRevert();
        hook.setACPContract(makeAddr("newACP"));
    }

    function test_setACPContract_revertsZero() public {
        vm.prank(owner);
        vm.expectRevert(MaiatACPHook__ZeroAddress.selector);
        hook.setACPContract(address(0));
    }

    /*//////////////////////////////////////////////////////////////
                    ADMIN: SET ALLOW UNINITIALIZED
    //////////////////////////////////////////////////////////////*/

    function test_setAllowUninitialized_works() public {
        vm.prank(owner);
        hook.setAllowUninitialized(false);
        assertFalse(hook.allowUninitialized());
    }

    function test_setAllowUninitialized_revertsNonOwner() public {
        vm.prank(attacker);
        vm.expectRevert();
        hook.setAllowUninitialized(false);
    }

    /*//////////////////////////////////////////////////////////////
                    STATS TRACKING
    //////////////////////////////////////////////////////////////*/

    function test_stats_trackCorrectly() public {
        oracle.setUserData(client, 80, true);
        oracle.setUserData(provider, 60, true);

        // Fund 3 times
        bytes memory fundData = abi.encode(client, bytes(""));
        hook.beforeAction(0, FUND_SELECTOR, fundData);
        hook.beforeAction(1, FUND_SELECTOR, fundData);
        hook.beforeAction(2, FUND_SELECTOR, fundData);
        assertEq(hook.totalFundGated(), 3);

        // Complete 2, reject 1
        uint256 job0 = acpReader.createMockJob(client, provider);
        uint256 job1 = acpReader.createMockJob(client, provider);
        uint256 job2 = acpReader.createMockJob(client, provider);

        hook.afterAction(job0, COMPLETE_SELECTOR, bytes(""));
        hook.afterAction(job1, COMPLETE_SELECTOR, bytes(""));
        hook.afterAction(job2, REJECT_SELECTOR, bytes(""));

        assertEq(hook.totalCompleted(), 2);
        assertEq(hook.totalRejected(), 1);
    }
}
