// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/**
 * @custom:security-contact security@maiat.xyz
 */

import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {BeforeSwapDelta} from "v4-core/types/BeforeSwapDelta.sol";
import {ModifyLiquidityParams, SwapParams} from "v4-core/types/PoolOperation.sol";

/// @title BaseHook
/// @notice Production-ready abstract base for Uniswap V4 hooks.
///         Replaces BaseTestHooks (test-only utility) with a proper production base.
///
/// @dev Key production requirements:
///      1. Hook callbacks MUST verify msg.sender == poolManager (onlyPoolManager).
///      2. Hook address bits MUST match getHookPermissions() — validated by PoolManager
///         at pool initialization (IPoolManager.initialize → validateHookPermissions).
///      3. Use HookMiner + CREATE2 to deploy to an address with correct permission bits.
///
/// @dev Note on address validation: Uniswap V4 PoolManager calls validateHookPermissions
///      during pool initialization, so we do NOT duplicate the check here. This also
///      keeps the constructor compatible with Foundry test environments where hook
///      addresses are not mined.
abstract contract BaseHook is IHooks {
    error BaseHook__NotPoolManager(address caller);
    error BaseHook__NotImplemented();

    /// @notice The Uniswap V4 PoolManager this hook is registered with.
    IPoolManager public immutable poolManager;

    /// @notice Reverts if caller is not the PoolManager.
    modifier onlyPoolManager() {
        if (msg.sender != address(poolManager)) revert BaseHook__NotPoolManager(msg.sender);
        _;
    }

    constructor(IPoolManager _poolManager) {
        poolManager = _poolManager;
    }

    /// @notice Declare which hook callbacks this hook implements.
    /// @dev Called by PoolManager during pool initialization to validate
    ///      that the hook address bits match declared permissions.
    function getHookPermissions() public pure virtual returns (Hooks.Permissions memory);

    // ─── Default stubs — revert if called without override ─────
    // All stubs enforce onlyPoolManager to prevent unauthorized direct calls.

    function beforeInitialize(address, PoolKey calldata, uint160)
        external virtual onlyPoolManager returns (bytes4)
    { revert BaseHook__NotImplemented(); }

    function afterInitialize(address, PoolKey calldata, uint160, int24)
        external virtual onlyPoolManager returns (bytes4)
    { revert BaseHook__NotImplemented(); }

    function beforeAddLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, bytes calldata)
        external virtual onlyPoolManager returns (bytes4)
    { revert BaseHook__NotImplemented(); }

    function afterAddLiquidity(
        address, PoolKey calldata, ModifyLiquidityParams calldata,
        BalanceDelta, BalanceDelta, bytes calldata
    ) external virtual onlyPoolManager returns (bytes4, BalanceDelta)
    { revert BaseHook__NotImplemented(); }

    function beforeRemoveLiquidity(address, PoolKey calldata, ModifyLiquidityParams calldata, bytes calldata)
        external virtual onlyPoolManager returns (bytes4)
    { revert BaseHook__NotImplemented(); }

    function afterRemoveLiquidity(
        address, PoolKey calldata, ModifyLiquidityParams calldata,
        BalanceDelta, BalanceDelta, bytes calldata
    ) external virtual onlyPoolManager returns (bytes4, BalanceDelta)
    { revert BaseHook__NotImplemented(); }

    function beforeSwap(address, PoolKey calldata, SwapParams calldata, bytes calldata)
        external virtual onlyPoolManager returns (bytes4, BeforeSwapDelta, uint24)
    { revert BaseHook__NotImplemented(); }

    function afterSwap(address, PoolKey calldata, SwapParams calldata, BalanceDelta, bytes calldata)
        external virtual onlyPoolManager returns (bytes4, int128)
    { revert BaseHook__NotImplemented(); }

    function beforeDonate(address, PoolKey calldata, uint256, uint256, bytes calldata)
        external virtual onlyPoolManager returns (bytes4)
    { revert BaseHook__NotImplemented(); }

    function afterDonate(address, PoolKey calldata, uint256, uint256, bytes calldata)
        external virtual onlyPoolManager returns (bytes4)
    { revert BaseHook__NotImplemented(); }
}
