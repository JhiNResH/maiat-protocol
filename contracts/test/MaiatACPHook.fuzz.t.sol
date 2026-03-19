// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test} from "forge-std/Test.sol";
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
} from "../src/acp/MaiatACPHook.sol";

/*//////////////////////////////////////////////////////////////
                    MOCK: TrustOracle (Fuzz)
//////////////////////////////////////////////////////////////*/

contract FuzzMockOracle is ITrustOracle {
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
                    MOCK: AgenticCommerce Reader (Fuzz)
//////////////////////////////////////////////////////////////*/

contract FuzzMockACPReader is IAgenticCommerceReader {
    mapping(uint256 => Job) public jobs;

    function setJob(uint256 jobId, address _client, address _provider) external {
        jobs[jobId] = Job({
            id: jobId,
            client: _client,
            provider: _provider,
            evaluator: address(0),
            description: "fuzz job",
            budget: 1 ether,
            expiredAt: block.timestamp + 7 days,
            status: 2,
            hook: address(0)
        });
    }

    function getJob(uint256 jobId) external view returns (Job memory) {
        return jobs[jobId];
    }
}

/*//////////////////////////////////////////////////////////////
                    FUZZ TESTS
//////////////////////////////////////////////////////////////*/

contract MaiatACPHookFuzzTest is Test {
    MaiatACPHook public hook;
    FuzzMockOracle public oracle;
    FuzzMockACPReader public acpReader;

    address public owner = makeAddr("owner");

    function setUp() public {
        oracle = new FuzzMockOracle();
        acpReader = new FuzzMockACPReader();

        hook = new MaiatACPHook(
            address(oracle),
            address(acpReader),
            30, // clientThreshold
            20, // providerThreshold
            true,
            owner
        );
    }

    /*//////////////////////////////////////////////////////////////
                    FUZZ: beforeAction fund
    //////////////////////////////////////////////////////////////*/

    /// @dev Any initialized client with score >= threshold should pass fund gate
    function testFuzz_beforeAction_fund_passesAboveThreshold(uint256 score) public {
        score = bound(score, 30, 200); // >= clientThreshold(30)
        address fuzzClient = makeAddr("fuzzClient");
        oracle.setUserData(fuzzClient, score, true);
        bytes memory data = abi.encode(fuzzClient, bytes(""));

        hook.beforeAction(0, hook.FUND_SELECTOR(), data);
        assertEq(hook.totalFundGated(), 1);
    }

    /// @dev Any initialized client with score < threshold should revert
    function testFuzz_beforeAction_fund_revertsBelowThreshold(uint256 score) public {
        score = bound(score, 0, 29); // < clientThreshold(30), all < 100 so no capping
        address fuzzClient = makeAddr("fuzzClient");
        oracle.setUserData(fuzzClient, score, true);
        bytes memory data = abi.encode(fuzzClient, bytes(""));

        bytes4 fundSel = hook.FUND_SELECTOR();
        vm.expectRevert();
        hook.beforeAction(0, fundSel, data);
        // State should NOT have changed (revert rolls back)
        assertEq(hook.totalFundGated(), 0);
    }

    /// @dev Scores > MAX_SCORE should be capped to 100 and still pass if >= threshold
    function testFuzz_beforeAction_fund_capsScoreAbove100(uint256 score) public {
        score = bound(score, 101, type(uint256).max);
        address fuzzClient = makeAddr("fuzzClient");
        oracle.setUserData(fuzzClient, score, true);
        bytes memory data = abi.encode(fuzzClient, bytes(""));

        // Capped to 100 which is >= 30 threshold, should pass
        hook.beforeAction(0, hook.FUND_SELECTOR(), data);
        assertEq(hook.totalFundGated(), 1);
    }

    /*//////////////////////////////////////////////////////////////
                    FUZZ: beforeAction submit
    //////////////////////////////////////////////////////////////*/

    /// @dev Any initialized provider with score >= threshold should pass submit check
    function testFuzz_beforeAction_submit_passesAboveThreshold(uint256 score) public {
        score = bound(score, 20, 200); // >= providerThreshold(20)
        address fuzzProvider = makeAddr("fuzzProvider");
        oracle.setUserData(fuzzProvider, score, true);
        bytes memory data = abi.encode(fuzzProvider, bytes32(0), bytes(""));

        hook.beforeAction(0, hook.SUBMIT_SELECTOR(), data);
    }

    /// @dev Any initialized provider with score < threshold should revert
    function testFuzz_beforeAction_submit_revertsBelowThreshold(uint256 score) public {
        score = bound(score, 0, 19); // < providerThreshold(20), all < 100 so no capping
        address fuzzProvider = makeAddr("fuzzProvider");
        oracle.setUserData(fuzzProvider, score, true);
        bytes memory data = abi.encode(fuzzProvider, bytes32(0), bytes(""));

        bytes4 submitSel = hook.SUBMIT_SELECTOR();
        vm.expectRevert();
        hook.beforeAction(0, submitSel, data);
    }

    /*//////////////////////////////////////////////////////////////
                    FUZZ: afterAction outcome recording
    //////////////////////////////////////////////////////////////*/

    /// @dev Complete and reject should properly track stats regardless of jobId
    function testFuzz_afterAction_tracksStats(uint256 numComplete, uint256 numReject) public {
        numComplete = bound(numComplete, 0, 20);
        numReject = bound(numReject, 0, 20);

        address fuzzClient = makeAddr("fuzzClient");
        address fuzzProvider = makeAddr("fuzzProvider");
        oracle.setUserData(fuzzClient, 50, true);
        oracle.setUserData(fuzzProvider, 50, true);

        for (uint256 i = 0; i < numComplete; i++) {
            acpReader.setJob(i, fuzzClient, fuzzProvider);
            hook.afterAction(i, hook.COMPLETE_SELECTOR(), bytes(""));
        }

        for (uint256 j = 0; j < numReject; j++) {
            uint256 jobId = numComplete + j;
            acpReader.setJob(jobId, fuzzClient, fuzzProvider);
            hook.afterAction(jobId, hook.REJECT_SELECTOR(), bytes(""));
        }

        assertEq(hook.totalCompleted(), numComplete);
        assertEq(hook.totalRejected(), numReject);
    }

    /*//////////////////////////////////////////////////////////////
                    FUZZ: setThresholds
    //////////////////////////////////////////////////////////////*/

    /// @dev Any thresholds 0-100 should be accepted
    function testFuzz_setThresholds_validRange(uint256 clientT, uint256 providerT) public {
        clientT = bound(clientT, 0, 100);
        providerT = bound(providerT, 0, 100);

        vm.prank(owner);
        hook.setThresholds(clientT, providerT);
        assertEq(hook.clientThreshold(), clientT);
        assertEq(hook.providerThreshold(), providerT);
    }

    /// @dev Any thresholds > 100 should revert
    function testFuzz_setThresholds_revertsAbove100(uint256 badThreshold) public {
        badThreshold = bound(badThreshold, 101, type(uint256).max);

        vm.prank(owner);
        vm.expectRevert(
            abi.encodeWithSelector(MaiatACPHook__ThresholdOutOfRange.selector, badThreshold)
        );
        hook.setThresholds(badThreshold, 50);
    }

    /*//////////////////////////////////////////////////////////////
                    FUZZ: constructor thresholds
    //////////////////////////////////////////////////////////////*/

    /// @dev Constructor should accept any thresholds 0-100
    function testFuzz_constructor_validThresholds(uint256 clientT, uint256 providerT) public {
        clientT = bound(clientT, 0, 100);
        providerT = bound(providerT, 0, 100);

        MaiatACPHook newHook = new MaiatACPHook(
            address(oracle), address(acpReader), clientT, providerT, true, owner
        );
        assertEq(newHook.clientThreshold(), clientT);
        assertEq(newHook.providerThreshold(), providerT);
    }

    /// @dev Constructor should revert for thresholds > 100
    function testFuzz_constructor_revertsInvalidThreshold(uint256 badThreshold) public {
        badThreshold = bound(badThreshold, 101, type(uint256).max);

        vm.expectRevert(
            abi.encodeWithSelector(MaiatACPHook__ThresholdOutOfRange.selector, badThreshold)
        );
        new MaiatACPHook(
            address(oracle), address(acpReader), badThreshold, 20, true, owner
        );
    }

    /*//////////////////////////////////////////////////////////////
                    FUZZ: non-matching selectors pass through
    //////////////////////////////////////////////////////////////*/

    /// @dev Any random selector should not revert in beforeAction
    function testFuzz_beforeAction_randomSelectorPassesThrough(bytes4 randomSelector) public {
        // Skip our known selectors
        vm.assume(randomSelector != hook.FUND_SELECTOR());
        vm.assume(randomSelector != hook.SUBMIT_SELECTOR());

        hook.beforeAction(0, randomSelector, bytes(""));
        assertEq(hook.totalFundGated(), 0);
    }

    /// @dev Any random selector should not change stats in afterAction
    function testFuzz_afterAction_randomSelectorNoOp(bytes4 randomSelector) public {
        vm.assume(randomSelector != hook.COMPLETE_SELECTOR());
        vm.assume(randomSelector != hook.REJECT_SELECTOR());

        hook.afterAction(0, randomSelector, bytes(""));
        assertEq(hook.totalCompleted(), 0);
        assertEq(hook.totalRejected(), 0);
    }
}
