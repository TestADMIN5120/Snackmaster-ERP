# Stock Reconciliation — Functional Document

**For:** SnackMaster ERP (Warehouse, Refillers & Vending Machines)
**Audience:** Business users — Admin, Warehouse team, Refillers, Management
**Related:** See `RECONCILIATION.md` for the technical design.

---

## 1. What Is Reconciliation?

Reconciliation is the process of regularly checking that **what the system says we have** matches **what we actually have** — and fixing any differences in a controlled, approved way.

In simple terms, we answer three questions:

1. **Do the books match reality?** (system stock vs physical stock in the warehouse)
2. **Did everything we handed out come back or get accounted for?** (stock given to refillers vs stock loaded into machines vs stock returned)
3. **Do machine sales match machine stock?** (what was sold vs what is missing from the machine)

---

## 2. Why Do We Need It?

Without reconciliation, small errors quietly grow into big losses:

- A carton is received but entered twice — the system thinks we have more than we do.
- A refiller is issued 50 packets but loads only 45 — 5 packets disappear with no record.
- Products expire on the shelf but are never written off — stock looks healthy but isn't sellable.
- A machine vends a product but the sale fails to record — machine count and sales don't match.
- Someone corrects a number directly without any note — no one knows why the stock changed.

Reconciliation gives us: **accurate stock**, **accountability at every handover**, **early detection of theft/damage/errors**, and **trustworthy reports** for purchasing and finance decisions.

---

## 3. The Golden Rules

1. **Stock numbers are never edited directly.** Every correction is a recorded *Adjustment* with a reason, a date, and the names of who requested and who approved it.
2. **Every handover has two names.** When stock moves, we always record who gave it and who received it (this is already captured today as Received By / Issue By / Refiller / Returned By).
3. **The person who counts is not the person who approves.** Counting and approving are done by different people.
4. **Count blind.** The counter should not see the system quantity while counting — count first, compare after.
5. **Nothing is deleted.** Old records stay as they are; mistakes are corrected by new entries.

---

## 4. The Four Reconciliation Checks

### Check 1 — Warehouse Count (Books vs Physical)

*"Does the stock on the shelf match the stock in the system?"*

**How it works:**

1. Admin schedules a **stock count** — either a full count or a small "cycle count" (a few products at a time).
2. A warehouse team member physically counts the selected products and writes down the quantities — **without looking at system numbers**.
3. The counted numbers are entered into the system.
4. The system compares counted vs book quantity and shows the **difference (variance)** for each product.
5. For every difference, the team investigates and picks a reason:
   - Damaged / expired and not recorded
   - Counting mistake (recount to confirm)
   - Data entry mistake (e.g., wrong quantity on an inward entry)
   - Missing / unexplained (possible theft)
6. An **Admin (a different person from the counter) approves** the corrections. Only then does the system stock change.
7. The count is closed and locked. It cannot be changed afterwards.

**Example:**

| Product | System Says | Counted | Difference | Reason | Action |
|---|---|---|---|---|---|
| Lays Classic 50g | 120 | 118 | −2 | 2 packets crushed | Write off 2 as Damaged |
| Coca Cola 250ml | 45 | 45 | 0 | — | No action |
| Parle-G 100g | 80 | 86 | +6 | Return entry missed | Add 6 with reason noted |

---

### Check 2 — Refiller Accountability (Issued vs Loaded vs Returned)

*"Did everything given to the refiller reach the machines or come back?"*

For every issue to a refiller, this equation must balance:

> **Quantity Issued = Quantity Loaded into Machines + Quantity Returned + Difference**

**How it works:**

1. Admin issues stock to a refiller (per product, per destination machine) — the system already records the refiller's name and the machines.
2. After the visit, the refiller confirms per product: how much was **loaded** into each machine and how much is being **returned** to the warehouse.
3. Warehouse confirms the returned quantity when receiving it back (Returned By / Received By — already captured today).
4. If issued ≠ loaded + returned, the system flags a **difference against that refiller**.
5. Admin reviews with the refiller: was it breakage on route? A counting error? The difference is either corrected (if it was an entry mistake) or written off with the refiller's name attached.

**Example:**

> refiller_one is issued 60 units. He loads 50 into SNACK-001 and 8 into SNACK-002, and returns 0.
> 60 − (50 + 8) − 0 = **2 units unaccounted** → flagged against refiller_one for review.

**Why it matters:** differences are tracked *per refiller over time*. One-off small differences are normal; a repeating pattern for the same person is a red flag.

---

### Check 3 — Machine Check (Expected vs Actual)

*"Does the stock inside the machine match refills minus sales?"*

For every machine, between two refill visits:

> **Expected Stock = Stock at Last Visit + Quantity Refilled − Quantity Sold**

**How it works:**

1. On every refill visit, **before loading**, the refiller counts what is actually in the machine (per slot).
2. The system compares this actual count with the expected stock.
3. Differences point to: vending failures (product stuck/dropped without sale), unrecorded sales, expired items removed, or pilferage.
4. Differences are logged per machine per visit. Machines with repeated differences are flagged for inspection.

**Example:**

> SNACK-001 had 40 units after the last visit. It was refilled with 0 since, and sales show 25 sold.
> Expected: 40 − 25 = 15. Refiller counts 13. → **2 units difference** logged for SNACK-001.

---

### Check 4 — System Health Check (automatic, behind the scenes)

*"Do the system's own numbers agree with each other?"*

The system keeps stock in two ways: a **running total per product** and the **detailed movement history** (every inward, outward, return, write-off). Every night, the system automatically compares the two. If they disagree for any product, the Admin sees an alert and the detailed history is treated as the truth. No user action is needed unless an alert appears.

---

## 5. Who Does What

| Role | Responsibilities |
|---|---|
| **Warehouse team member** | Performs physical counts (blind), receives returned stock, records damages when found |
| **Refiller** | Counts machine stock at each visit before loading, confirms loaded & returned quantities, explains differences attributed to them |
| **Admin** | Schedules counts, reviews differences, approves/rejects adjustments (never approves their own), resolves refiller and machine variances |
| **Management** | Reviews monthly reconciliation summary: total shrinkage value, differences by refiller and by machine, unresolved items |

---

## 6. How Often

| Activity | Frequency |
|---|---|
| System health check | Every night (automatic) |
| Cycle count — fast-moving products | Weekly (a few products each week) |
| Cycle count — slow-moving products | Monthly |
| Full warehouse count | Quarterly |
| Refiller accountability check | Every issue / kit close-out |
| Machine check | Every refill visit |
| Management summary review | Monthly |

---

## 7. Handling Differences

1. **Small differences** (below a limit set by Admin, e.g. up to 2 units or ₹100 per product) — recorded with a reason and auto-approved, so daily work isn't blocked.
2. **Larger differences** — always require investigation and a second person's approval before stock is corrected.
3. **Every approved correction** shows: product, quantity (+/−), reason, who requested, who approved, and which count/visit it came from.
4. **Unresolved differences** stay visible on the Admin's dashboard until closed — they cannot be silently ignored.
5. **Target:** every flagged difference resolved within 2 working days.

---

## 8. Monthly Closing (Recommended Practice)

At the end of each month:

1. Complete all pending counts and resolve all flagged differences.
2. The system produces a **closing stock statement** per product: Opening + Inward − Outward + Returned − Expired/Damaged ± Adjustments = Closing.
3. Admin signs off the month. After sign-off, that month's figures are **locked** — next month starts from these closing numbers.
4. Management receives the summary: total shrinkage (units & value), top variance products, variance by refiller, variance by machine.

---

## 9. What Success Looks Like

- Physical counts match the system for **98%+ of products**.
- Less than **1% of issued stock** unaccounted for per month.
- Every stock correction has a reason and an approver — **no unexplained changes**.
- Differences are caught within days (at the next count/visit), not months.
- Management trusts the stock report enough to base purchasing and audits on it.

---

## 10. Quick Reference — Daily Life With Reconciliation

- **Receiving stock?** Enter it the same day, with supplier invoice and the receiver's name.
- **Issuing to a refiller?** Always through the Outward screen — never hand over stock without an entry.
- **Refiller back from route?** Return leftover stock immediately; warehouse confirms receipt.
- **Found damaged/expired stock?** Record it the moment you find it — don't wait for the count.
- **Count day?** Count first, compare after. Never "adjust to match."
- **See a difference?** Report it — a recorded loss is a solvable problem; a hidden one is not.
