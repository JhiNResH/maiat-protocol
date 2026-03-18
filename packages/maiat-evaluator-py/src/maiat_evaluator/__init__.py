"""Maiat Evaluator — Drop-in trust evaluator for Virtuals ACP / GAME SDK.

Usage (one-line integration):

    from maiat_evaluator import maiat_evaluator

    acp_plugin = AcpPlugin(
        options=AcpPluginOptions(
            api_key=GAME_API_KEY,
            acp_client=VirtualsACP(
                wallet_private_key=WALLET_KEY,
                agent_wallet_address=AGENT_WALLET,
                entity_id=ENTITY_ID,
                on_evaluate=maiat_evaluator(),  # <--- one line
            ),
            evaluator_cluster="MAIAT",
        )
    )
"""

from .evaluator import maiat_evaluator, MaiatEvaluator

__version__ = "0.1.0"
__all__ = ["maiat_evaluator", "MaiatEvaluator"]
