// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {DojoTrustScore} from "../src/dojo/DojoTrustScore.sol";
import {ITrustOracle} from "../src/interfaces/ITrustOracle.sol";

contract DojoTrustScoreTest is Test {
    DojoTrustScore public trust;

    address public admin = address(this);
    address public evaluator = address(0xE1);
    address public attacker = address(0xBAD);
    address public subject = address(0x42);

    bytes32 constant DOJO = bytes32("dojo");
    bytes32 constant IOT = bytes32("iot");

    event ScoreUpdated(address indexed subject, bytes32 indexed vertical, uint16 overall, uint32 sessionCount);

    function setUp() public {
        trust = new DojoTrustScore(admin);
        trust.grantRole(trust.EVALUATOR_ROLE(), evaluator);
    }

    /*//////////////////////////////////////////////////////////////
                        BASIC SCORING
    //////////////////////////////////////////////////////////////*/

    function test_UpdateScore_PerfectScore() public {
        vm.prank(evaluator);
        // All components at max (10000 bps each)
        // weighted = 10000*3500 + 10000*2500 + 10000*1500 + 10000*1500 + 10000*1000
        //          = 35M + 25M + 15M + 15M + 10M = 100M
        // overall  = 100M / 1M = 100
        trust.updateScore(subject, DOJO, 10000, 10000, 10000, 10000, 10000, 50);

        assertEq(trust.getScore(subject, DOJO), 100);

        DojoTrustScore.Score memory s = trust.getFullScore(subject, DOJO);
        assertEq(s.overall, 100);
        assertEq(s.evaluatorSuccess, 10000);
        assertEq(s.buyerAvgRating, 10000);
        assertEq(s.sellerAvgBehavior, 10000);
        assertEq(s.volumeScore, 10000);
        assertEq(s.uptimeScore, 10000);
        assertEq(s.sessionCount, 50);
        assertGt(s.lastUpdated, 0);
    }

    function test_UpdateScore_ZeroScore() public {
        vm.prank(evaluator);
        trust.updateScore(subject, DOJO, 0, 0, 0, 0, 0, 0);
        assertEq(trust.getScore(subject, DOJO), 0);
    }

    function test_UpdateScore_WeightedCalculation() public {
        // evaluator=8000(80%), buyer=7000(70%), seller=6000(60%), volume=5000(50%), uptime=9000(90%)
        // weighted = 8000*3500 + 7000*2500 + 6000*1500 + 5000*1500 + 9000*1000
        //          = 28M + 17.5M + 9M + 7.5M + 9M = 71M
        // overall  = 71M / 1M = 71
        vm.prank(evaluator);
        trust.updateScore(subject, DOJO, 8000, 7000, 6000, 5000, 9000, 10);
        assertEq(trust.getScore(subject, DOJO), 71);
    }

    function test_UpdateScore_EmitsEvent() public {
        vm.prank(evaluator);
        vm.expectEmit(true, true, false, true);
        emit ScoreUpdated(subject, DOJO, 71, 10);
        trust.updateScore(subject, DOJO, 8000, 7000, 6000, 5000, 9000, 10);
    }

    function test_UpdateScore_Overwrites() public {
        vm.startPrank(evaluator);
        trust.updateScore(subject, DOJO, 5000, 5000, 5000, 5000, 5000, 5);
        assertEq(trust.getScore(subject, DOJO), 50);

        trust.updateScore(subject, DOJO, 10000, 10000, 10000, 10000, 10000, 15);
        assertEq(trust.getScore(subject, DOJO), 100);

        DojoTrustScore.Score memory s = trust.getFullScore(subject, DOJO);
        assertEq(s.sessionCount, 15);
        vm.stopPrank();
    }

    /*//////////////////////////////////////////////////////////////
                        MULTI-VERTICAL
    //////////////////////////////////////////////////////////////*/

    function test_MultiVertical_IndependentScores() public {
        vm.startPrank(evaluator);
        trust.updateScore(subject, DOJO, 8000, 8000, 8000, 8000, 8000, 10);
        trust.updateScore(subject, IOT, 3000, 3000, 3000, 3000, 3000, 2);
        vm.stopPrank();

        assertEq(trust.getScore(subject, DOJO), 80);
        assertEq(trust.getScore(subject, IOT), 30);
    }

    function test_UnsetVertical_ReturnsZero() public view {
        assertEq(trust.getScore(subject, DOJO), 0);
    }

    /*//////////////////////////////////////////////////////////////
                        ACCESS CONTROL
    //////////////////////////////////////////////////////////////*/

    function test_UpdateScore_NotEvaluatorReverts() public {
        vm.prank(attacker);
        vm.expectRevert();
        trust.updateScore(subject, DOJO, 5000, 5000, 5000, 5000, 5000, 1);
    }

    function test_AdminCanUpdate() public {
        // Admin has evaluator role by default
        trust.updateScore(subject, DOJO, 5000, 5000, 5000, 5000, 5000, 1);
        assertEq(trust.getScore(subject, DOJO), 50);
    }

    /*//////////////////////////////////////////////////////////////
                        VALIDATION
    //////////////////////////////////////////////////////////////*/

    function test_ComponentOutOfRange_Reverts() public {
        vm.startPrank(evaluator);

        vm.expectRevert(DojoTrustScore.DojoTrustScore__ComponentOutOfRange.selector);
        trust.updateScore(subject, DOJO, 10001, 5000, 5000, 5000, 5000, 1);

        vm.expectRevert(DojoTrustScore.DojoTrustScore__ComponentOutOfRange.selector);
        trust.updateScore(subject, DOJO, 5000, 10001, 5000, 5000, 5000, 1);

        vm.expectRevert(DojoTrustScore.DojoTrustScore__ComponentOutOfRange.selector);
        trust.updateScore(subject, DOJO, 5000, 5000, 10001, 5000, 5000, 1);

        vm.expectRevert(DojoTrustScore.DojoTrustScore__ComponentOutOfRange.selector);
        trust.updateScore(subject, DOJO, 5000, 5000, 5000, 10001, 5000, 1);

        vm.expectRevert(DojoTrustScore.DojoTrustScore__ComponentOutOfRange.selector);
        trust.updateScore(subject, DOJO, 5000, 5000, 5000, 5000, 10001, 1);

        vm.stopPrank();
    }

    /*//////////////////////////////////////////////////////////////
                        ITRUST ORACLE INTERFACE
    //////////////////////////////////////////////////////////////*/

    function test_ITrustOracle_ReturnsDefaultVertical() public {
        vm.prank(evaluator);
        trust.updateScore(subject, DOJO, 8000, 7000, 6000, 5000, 9000, 10);

        // ITrustOracle.getTrustScore should return the "dojo" vertical score
        ITrustOracle oracle = ITrustOracle(address(trust));
        assertEq(oracle.getTrustScore(subject), 71);
    }

    function test_ITrustOracle_UnknownUserReturnsZero() public view {
        ITrustOracle oracle = ITrustOracle(address(trust));
        assertEq(oracle.getTrustScore(address(0xDEAD)), 0);
    }

    function test_ITrustOracle_OnlyReadsDefaultVertical() public {
        vm.startPrank(evaluator);
        trust.updateScore(subject, DOJO, 8000, 8000, 8000, 8000, 8000, 10);
        trust.updateScore(subject, IOT, 3000, 3000, 3000, 3000, 3000, 2);
        vm.stopPrank();

        ITrustOracle oracle = ITrustOracle(address(trust));
        // Should return DOJO score (80), not IOT score (30)
        assertEq(oracle.getTrustScore(subject), 80);
    }

    function test_DEFAULT_VERTICAL_IsDojo() public view {
        assertEq(trust.DEFAULT_VERTICAL(), bytes32("dojo"));
    }

    /*//////////////////////////////////////////////////////////////
                        FUZZ
    //////////////////////////////////////////////////////////////*/

    function testFuzz_WeightedFormula(
        uint16 eval_,
        uint16 buyer,
        uint16 seller,
        uint16 vol,
        uint16 uptime,
        uint32 sessions
    ) public {
        eval_ = uint16(bound(eval_, 0, 10000));
        buyer = uint16(bound(buyer, 0, 10000));
        seller = uint16(bound(seller, 0, 10000));
        vol = uint16(bound(vol, 0, 10000));
        uptime = uint16(bound(uptime, 0, 10000));

        vm.prank(evaluator);
        trust.updateScore(subject, DOJO, eval_, buyer, seller, vol, uptime, sessions);

        uint256 expected = (
            uint256(eval_) * 3500 +
            uint256(buyer) * 2500 +
            uint256(seller) * 1500 +
            uint256(vol) * 1500 +
            uint256(uptime) * 1000
        ) / 1_000_000;

        assertEq(trust.getScore(subject, DOJO), uint16(expected));
    }
}
