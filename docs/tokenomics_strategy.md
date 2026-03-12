# MAIAT x Scarab: Tokenomics Strategy

Based on our project status where **Scarab** is an "arcade token" (off-chain/reward-focused) and **MAIAT** is the capital/reputation layer, here is how to use the 25% ACF and 25% Team allocations effectively.

## 1. Automated Capital Formation (ACF) - 25%
**Role: The Ecosystem Fuel**

ACF automatically sells MAIAT tokens for USDC as the FDV grows. This creates a treasury that is **not** dependent on team manual selling.

### Strategic Use Cases:
*   **House Liquidity for Scarab Arcade**: Use the USDC treasury to provide the "initial liquidity" for prediction markets. This ensures users can always bet and win even before there is a large concurrent user base.
*   **Infrastructure & Gas Subsidies**: Scarab is currently off-chain to reduce friction. ACF funds the servers and the eventual gas costs for "settling" large Scarab wins onto the Base mainnet (when Phase 3 starts).
*   **Buyback & Burn (Data Validation)**: As specified in the spec, 30% of revenue goes to buybacks. ACF ensures the project has the operational runway to *reach* the revenue stage.

---

## 2. Team Allocation - 25%
**Role: Long-term Alignment & Growth Engines**

With a 1-year lock and 6-month vest, these tokens are for the core builders and contributors.

### Strategic Use Cases:
*   **Leaderboard Rewards (Transition Tool)**: Use a portion of the "Ecosystem Rewards" (7.5% of total supply) to reward the top Scarab earners. This bridges the gap between the "fun" arcade token (Scarab) and real economic value (MAIAT).
*   **Bounty Board**: Reward developers who integrate `maiat-sdk` into new agent frameworks or apps using tokens from the Development Fund.
*   **Strategic Partnerships**: Allocate tokens from the Strategic Reserve to other Virtuals projects that agree to use Scarab for their own in-game reputations.

---

## 3. Strategic Allocation Matrix (50% Combined)

We divide the 50% into two types of "power": **ACF (USDC/Operational Power)** and **Team (MAIAT/Incentive Power)**.

| Category | ACF (25% USDC Treasury) | Team (25% MAIAT Stake) |
| :--- | :--- | :--- |
| **Dev** | **Infra Costs**: Railway, Supabase, RPC nodes, Security APIs (GoPlus). | **SDK Bounties**: Rewards for contributors building the ElizaOS/GAME plugins. |
| **Marketing** | **House Pools**: Providing USDC liquidity to Scarab markets so "winners" get real value. | **Ecosystem Grants**: Airdropping MAIAT to other Virtuals projects that adopt Maiat scores. |
| **Campaigns** | **Sponsored Events**: Funding gas/fees for high-traffic "Scarab Weeks". | **Leaderboard Payouts**: Direct MAIAT rewards for the top 10 Scarab earners monthly. |
| **Buyback** | **Liquidity Depth**: Ensuring enough USDC in the pair to support revenue buybacks. | **Staking Yield**: Lock-up programs to reduce circulating supply during peak hype. |

---

## 4. Deep Dive: Incentives & Buyback

### A. Incentivizing Users (Scarab → MAIAT)
The goal is to move users from "Playing for Fun" to "Investing for Value":
1.  **Proof of Activity**: Users burn Scarab to review or bet.
2.  **High-Quality Signal**: Only users with a high **Reputation Score** (earned via correct predictions) qualify for the **Team Allocation Airdrops**.
3.  **Result**: We incentivize *quality data production*, not just click-farming.

### B. The Buyback & Burn Flywheel
The 50% allocation supports the buyback indirectly but powerfully:
*   **Revenue Source**: 30% of all ACP Query revenue (USDC) is used to market-buy MAIAT.
*   **The ACF Role**: By using ACF to fund **Marketing & Campaigns**, we drive query volume higher. Higher volume = more revenue = larger buybacks.
*   **The Team Role**: By rewarding top data producers, we ensure the "Trust Scores" are accurate. High accuracy = high demand for API = more revenue = larger buybacks.

### C. Campaign Strategy (The "Trust Expo")
*   **The Hook**: "Earn 10 Scarab to bet on which agent rugs next."
*   **The ACF Spend**: $500 USDC pool for the winners (funded by ACF treasury).
*   **The Marketing Goal**: Onboard 1,000 new wallets who now understand the "Trust Score" concept.
*   **The Long-term MAIAT Value**: These 1,000 users become the data set that makes the Maiat Oracle valuable to institutional buyers.

---

## 6. Dynamic Balancing: Scarab vs. MAIAT

A common risk in dual-token systems is **imbalance** (e.g., hyperinflation of the arcade token or dilution of the capital token). Here is how we mitigate this:

### A. Non-Fungibility of Scarab
Scarab is **off-chain and non-transferable** (SBT-like). It cannot be sold on a DEX. Its only exit to "real value" is the controlled **Team Allocation Bridge** (Leaderboard/Bounties). This prevents a massive dump of Scarab from affecting the MAIAT price.

### B. The "Variable Burn" Sink
To prevent Scarab hyperinflation, we implement a **Dynamic Cost Model**:
*   As the project grows, the Scarab cost of participating in high-value activities (like exclusive risk alerts) increases.
*   **Burn > Issuance**: We monitor the "Scarab Treasury." If total Scarab supply grows too fast, we increase the burn rate (e.g., review costs go from 2 to 5 🪲).

### C. Separate Utility (The "Pay-to-Play" Wall)
Scarab and MAIAT serve fundamentally different users:
*   **MAIAT (Investors/Protocol Partners)**: Hold for buybacks, staking, and governance.
*   **Scarab (Users/Data Producers)**: Use for utility, betting, and access.
By keeping the utility separate, an oversupply of Scarab users (data producers) actually **increases** the value of MAIAT because it produces better data for the paid API.

### D. The Safety Valve (Dynamic Ratio)
The MAIAT rewards for Scarab holders (via Team Allocation) are **not guaranteed in fixed amounts**:
*   We use a **Dynamic Reward Ratio**: If MAIAT price is low, we distribute fewer tokens to more people. If price is high, we distribute selectively.
*   Total MAIAT distribution is capped by the 25% Team/Ecosystem allocation, creating a hard ceiling on dilution.

---

## 8. Design Rationale: Why this is Reasonable

Is separating **Scarab (Arcade)** and **MAIAT (Governance)** the right move? **Yes.** Here is the industry-standard reasoning:

### A. Zero-Friction Adoption (The "Arcade" Hook)
If users had to buy MAIAT just to review an agent, adoption would be near zero due to gas and financial hurdles. 
*   **Reasonability**: Scarab allows "Try-before-you-buy." Users enter the ecosystem for free, generate value (data), and *then* decide to transition into the MAIAT capital layer.

### B. Anti-Speculation (Protecting the Data)
If the "Arcade Token" were tradeable on Day 1, bots would farm it and dump it, destroying the incentive for real humans to provide quality data.
*   **Reasonability**: By making Scarab an off-chain/SBT credit, we ensure that **Utility > Speculation**. The only way to get MAIAT value is through *consistent quality*, not just farming volume.

### C. Vertical Separation of Concerns
Standard "Play-to-Earn" (P2E) failed because the utility token was also the investment token. When the game slowed down, the token crashed, and the game died.
*   **Reasonability**:
    *   **Scarab** focuses on **Velocity & Engagement**.
    *   **MAIAT** focuses on **Scarcity & Governance**.
    Even if Scarab supply fluctuates significantly during a marketing campaign, the MAIAT "Capital Layer" is insulated.

### D. Compliance & Agility
Off-chain tokens (Scarab) are not subject to the same regulatory hurdles as tradeable assets.
*   **Reasonability**: We can iterate on the Scarab "game mechanics" (costs, rewards) daily without needing smart contract upgrades or affecting investor sentiment. Once the mechanics are proven, we move to the Phase 3 "On-chain Settlement."

---

## 10. Scarab to MAIAT: The "Performance Bridge"

Can you "swap" Scarab for MAIAT? **Not directly.** Here is why and how it actually works:

### A. Why no Direct Swap?
If 100 Scarab could always be swapped for 1 MAIAT, the value of MAIAT would be tied to the "easiest" way to farm Scarab. This would lead to hyperinflation and death of the capital layer.

### B. The Bridge: "Performance, not Liquidity"
We treat Scarab as the **fuel** you spend to earn **MAIAT rewards**. The conversion happens through three main channels:

| Method | Mechanism | User Action | reward |
| :--- | :--- | :--- | :--- |
| **Leaderboard** | **Competitive** | Top 10 users with highest **Scarab ROI** (wins/bets) share a monthly MAIAT pool. | High MAIAT payout |
| **Data Bounties** | **Contribution** | Users burn Scarab to submit "Deep Reviews." If the team/community validates the data, you get MAIAT. | Medium MAIAT payout |
| **Airdrop Gating** | **Reputation** | Future MAIAT airdrops are gated by "Lifetime Scarab Burn." You must have participated to qualify. | Variable MAIAT |

### C. Logic Summary
You don't **swap** the tokens; you **use** the arcade token to prove you are a valuable participant in the ecosystem. Your **success in the arcade** is what triggers the **Governance Token (MAIAT) reward**.

> [!IMPORTANT]
> This converts "effort and skill" into "equity," rather than converting "time and bots" into "exit liquidity."
