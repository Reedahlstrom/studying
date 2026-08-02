/* ══════════════════════════════════════════════════════════════
   The curriculum.

   Six phases. Inside each, PRINCIPLES — one idea per node, each
   standing on the ones named in `builds`. That's what draws the tree.

   Writing rule: answer in plain words, first sentence under ~15
   words. A second short line only if it earns its place. If you
   have to reread it, it's written wrong.
   ══════════════════════════════════════════════════════════════ */

export const PHASES = [
  { id: 'p1', name: 'Market Foundations',            short: 'Foundations', blurb: 'How choice, prices, and people actually work.' },
  { id: 'p2', name: 'Macro & the Economy',           short: 'Macro',       blurb: 'The weather every business operates inside.' },
  { id: 'p3', name: 'Financial Literacy',            short: 'Finance',     blurb: 'Reading a business in numbers.' },
  { id: 'p4', name: 'Entrepreneurship & Validation', short: 'Validation',  blurb: 'Find a real problem. Prove people want it.' },
  { id: 'p5', name: 'Business Models & Strategy',    short: 'Strategy',    blurb: 'Capture value, then keep it.' },
  { id: 'p6', name: 'Fundraising & Growth',          short: 'Growth',      blurb: 'Fund it, staff it, scale it.' },
];

export const PRINCIPLES = [
  /* ─────────────── Phase 1 · Market Foundations ─────────────── */
  {
    id: 'scarcity', phase: 'p1', title: 'Scarcity forces choice', builds: [],
    idea: 'Everything runs out. So every yes is a no to something else.',
    cards: [
      ['What is opportunity cost?', 'What you gave up to get it. The next-best thing you passed on.'],
      ['Why is "free" rarely free?', 'It still costs your time and attention. And whatever you would have done instead.'],
      ['What is a sunk cost?', 'Money or time already spent that you cannot get back.'],
      ['Why should a sunk cost never change your decision?', 'It is the same no matter what you pick next. Only the future can differ.'],
      ['You turn down a $90k job to start a company. What did year one cost you?', 'At least $90k, plus any cash you put in. Real cost, even though it never left your account.'],
      ['What is a trade-off?', 'Giving up one good thing to get another when you cannot have both.'],
    ],
  },
  {
    id: 'margin', phase: 'p1', title: 'Decisions happen at the margin', builds: ['scarcity'],
    idea: 'Real choices are almost never all-or-nothing. Ask about the next one.',
    cards: [
      ['What does "thinking at the margin" mean?', 'Judging the next one unit: is the extra benefit worth the extra cost?'],
      ['What is marginal cost?', 'The cost of making one more.'],
      ['Why can averages mislead you?', 'An average includes costs that will not change either way. Only what changes matters.'],
      ['What is the law of diminishing returns?', 'Each extra unit of an input adds less than the one before it.'],
      ['A flight has 30 empty seats. What does one more passenger cost?', 'Almost nothing — a little fuel and a snack. So a cheap last-minute seat can still make money.'],
      ['When should you stop doing more of something?', 'When the next one costs more than it is worth. Even if the whole thing is still profitable.'],
    ],
  },
  {
    id: 'supply-demand', phase: 'p1', title: 'Supply and demand find a price', builds: ['margin'],
    idea: 'Buyers want more when it is cheap. Sellers want to sell more when it is dear. Price is where they meet.',
    cards: [
      ['What is the law of demand?', 'Price up, quantity bought down.'],
      ['What is the law of supply?', 'Price up, quantity produced up.'],
      ['What is market equilibrium?', 'The price where the amount for sale equals the amount people want. No shortage, no leftovers.'],
      ['What is a shortage?', 'People want more than is for sale, because the price is too low.'],
      ['What is a surplus?', 'More is for sale than people want, because the price is too high.'],
      ['Demand changed, or quantity demanded changed — what is the difference?', 'Price moved you along the same curve. Anything else — income, taste, substitutes — moves the whole curve.'],
      ['What is elasticity of demand?', 'How much buying drops when the price goes up. A lot = elastic. Barely = inelastic.'],
      ['What makes demand inelastic?', 'No good substitutes, or the price is small next to the buyer\'s budget. Urgency does it too.'],
    ],
  },
  {
    id: 'prices', phase: 'p1', title: 'Prices are information', builds: ['supply-demand'],
    idea: 'A price is a message about how scarce and how wanted something is. Jam the message and behaviour goes wrong.',
    cards: [
      ['What does a rising price tell people?', 'It is scarcer or more wanted. Buyers use less, producers make more. Nobody had to be in charge.'],
      ['What is a price ceiling, and what does it cause?', 'A legal maximum price. Set below the market price it causes shortages and queues.'],
      ['What is a price floor, and what does it cause?', 'A legal minimum price. Set above the market price it causes surpluses — unsold goods, or unemployed workers.'],
      ['Why do incentives predict behaviour better than intentions?', 'People respond to the payoff in front of them, not the goal on the poster.'],
      ['What is a substitute good?', 'Something buyers switch to when yours costs more. More substitutes, less pricing power.'],
      ['What is a complement good?', 'Something bought alongside yours. Cheaper printers sell more ink.'],
    ],
  },
  {
    id: 'behavior', phase: 'p1', title: 'People are predictably irrational', builds: ['prices'],
    idea: 'Real buyers are not calculators. The predictable ways they bend are worth knowing.',
    cards: [
      ['What is loss aversion?', 'Losing $100 hurts about twice as much as gaining $100 feels good.'],
      ['What is anchoring?', 'The first number you hear drags your judgement toward it. That is what a crossed-out price is doing.'],
      ['What is framing?', 'The same fact feels different depending on wording. "90% survive" beats "10% die".'],
      ['What is the endowment effect?', 'You value something more once it is yours. Free trials work on this.'],
      ['What is social proof?', 'People copy what others are doing when they are unsure. Reviews and "most popular" tags sell.'],
      ['What is the sunk cost fallacy?', 'Continuing because of what you already spent. The classic irrational move.'],
      ['What is friction, and why does a tiny amount kill conversion?', 'Any extra step. People quit at small obstacles far more than logic predicts.'],
    ],
  },
  {
    id: 'time-value', phase: 'p1', title: 'Money has a time value', builds: ['scarcity'],
    idea: 'A dollar today beats a dollar later, because today\'s dollar can go to work.',
    cards: [
      ['Why is a dollar today worth more than a dollar next year?', 'You can use it in the meantime. And next year\'s dollar might not show up.'],
      ['What is an interest rate?', 'The price of using money for a while.'],
      ['What is compounding?', 'Earning returns on your past returns. Growth curves upward instead of climbing straight.'],
      ['What is discounting?', 'Compounding backwards — what a future amount is worth today.'],
      ['What is present value?', 'What money arriving later is worth right now.'],
      ['How do higher interest rates slow an economy?', 'Borrowing costs more and saving pays more, so people buy and build less.'],
      ['Rule of 72 — what is it for?', 'Divide 72 by the growth rate to get the years to double. At 8%, about 9 years.'],
    ],
  },

  /* ─────────────── Phase 2 · Macro & the Economy ─────────────── */
  {
    id: 'money-inflation', phase: 'p2', title: 'Money and inflation', builds: ['prices', 'time-value'],
    idea: 'Money is a claim on real stuff. More claims, same stuff, each claim buys less.',
    cards: [
      ['What are the three jobs of money?', 'A way to pay, a way to store value, and a way to keep score.'],
      ['What is inflation?', 'Prices rising across the board, so your money buys less.'],
      ['Nominal or real — what is the difference?', 'Nominal is the number on the page. Real is after inflation.'],
      ['A 4% raise during 6% inflation is what?', 'A 2% pay cut.'],
      ['What causes inflation?', 'Too much spending chasing too few goods, or inputs like energy and wages getting pricier.'],
      ['Who wins from unexpected inflation?', 'Borrowers. They repay with money that is worth less. Lenders eat it.'],
      ['What is deflation, and why is it feared?', 'Prices falling. People delay buying, sales drop, and debts get heavier. It feeds on itself.'],
    ],
  },
  {
    id: 'output', phase: 'p2', title: 'Output and growth', builds: ['money-inflation'],
    idea: 'A country lives on what it produces. Growth comes from producing more per hour, not working more hours.',
    cards: [
      ['What is GDP?', 'The value of everything finished an economy produces in a period.'],
      ['Why only finished goods?', 'Counting the flour and the bread counts the same value twice.'],
      ['Real or nominal GDP — which shows real growth?', 'Real. It strips out price changes, so you see if output actually grew.'],
      ['What is productivity?', 'Output per hour worked.'],
      ['Why does productivity matter more than hours?', 'More hours raises output once. More output per hour raises it forever.'],
      ['What drives long-run growth?', 'Investment, technology, skills, and rules that let people trade and keep the gains.'],
      ['What does GDP miss?', 'Unpaid work, who got the money, environmental damage, and quality improvements.'],
    ],
  },
  {
    id: 'cycles', phase: 'p2', title: 'Business cycles', builds: ['output'],
    idea: 'Economies do not grow in a straight line. They boom, overheat, shrink, recover.',
    cards: [
      ['Name the four phases of a business cycle.', 'Expansion, peak, contraction, trough.'],
      ['What counts as a recession?', 'Two quarters in a row of shrinking real GDP is the rule of thumb.'],
      ['How do growth and unemployment relate?', 'Opposite directions. Growing economies hire; shrinking ones cut.'],
      ['What is a leading indicator?', 'Something that turns before the economy does — new orders, building permits, the yield curve.'],
      ['Why is a recession a decent time to start a company?', 'Talent and space are cheap and big companies retreat. By launch, the cycle has usually turned.'],
    ],
  },
  {
    id: 'policy', phase: 'p2', title: 'Monetary vs fiscal policy', builds: ['cycles'],
    idea: 'Two levers, two different hands. One sets the price of money, the other spends and taxes.',
    cards: [
      ['What is monetary policy, and who runs it?', 'Setting interest rates and the money supply. The Fed, in the US.'],
      ['What is fiscal policy, and who runs it?', 'Government spending and taxes. Congress, not the Fed.'],
      ['What is the Fed\'s dual mandate?', 'Stable prices and maximum employment. The two often pull opposite ways.'],
      ['How does raising rates fight inflation?', 'Borrowing gets expensive, so people spend and build less, and prices cool.'],
      ['What is quantitative easing?', 'The central bank buying bonds to push long-term rates down when short rates are already near zero.'],
      ['Why does policy work slowly?', 'It takes a year or more to reach hiring and spending. They are steering with a delay.'],
    ],
  },
  {
    id: 'trade', phase: 'p2', title: 'Trade and exchange rates', builds: ['output'],
    idea: 'Countries trade for the same reason people do: both sides end up better off.',
    cards: [
      ['What is comparative advantage?', 'Do what you give up least to do, and trade for the rest. Both sides gain even if one is better at everything.'],
      ['What is an exchange rate?', 'The price of one currency in another.'],
      ['A strong dollar does what to US exporters?', 'Hurts them. Their goods cost foreigners more.'],
      ['What is a tariff, and who pays it?', 'A tax on imports. Domestic buyers pay it through higher prices.'],
      ['What is a trade deficit?', 'Importing more than you export. It is a fact, not automatically a problem.'],
      ['Why do currencies move?', 'Interest rates, inflation, and how much people want to invest in that country.'],
    ],
  },

  /* ─────────────── Phase 3 · Financial Literacy ─────────────── */
  {
    id: 'statements', phase: 'p3', title: 'The three statements', builds: ['time-value', 'money-inflation'],
    idea: 'Every business tells its story three ways: what it earned, what it owns, where the cash went.',
    cards: [
      ['What does the income statement show?', 'Revenue minus expenses over a period. Did it make a profit.'],
      ['What does the balance sheet show?', 'What it owns and owes, at one moment.'],
      ['What is the balance sheet equation?', 'Assets = liabilities + equity.'],
      ['What does the cash flow statement show?', 'Cash actually in and out — from operating, investing, and financing.'],
      ['Accrual vs cash accounting?', 'Accrual counts a sale when it is earned. Cash counts it when the money lands.'],
      ['A company is profitable and out of cash. How?', 'Customers pay late, or inventory ate the cash. Profit is a timing opinion; cash is a fact.'],
      ['What links the income statement to the balance sheet?', 'Profit flows into retained earnings under equity.'],
    ],
  },
  {
    id: 'bookkeeping', phase: 'p3', title: 'How the books work', builds: ['statements'],
    idea: 'Double entry is just the rule that every transaction has two sides. Ratios are shortcuts for reading them.',
    cards: [
      ['What is double-entry bookkeeping?', 'Every transaction is recorded twice — where the value came from and where it went. That is why the books balance.'],
      ['What is an asset?', 'Something the business owns that will bring future benefit.'],
      ['What is a liability?', 'Something the business owes.'],
      ['What is equity?', 'What is left for owners after debts. Assets minus liabilities.'],
      ['What is depreciation?', 'Spreading the cost of something long-lived across the years it is used.'],
      ['What is the current ratio, and what does it tell you?', 'Current assets ÷ current liabilities. Can it cover the next year\'s bills.'],
      ['What is return on investment?', 'Gain ÷ what you put in.'],
      ['What is EBITDA, and why treat it carefully?', 'Earnings before interest, tax, depreciation, and amortisation. It flatters companies with real debt and real equipment.'],
    ],
  },
  {
    id: 'margins', phase: 'p3', title: 'Margins and cost structure', builds: ['statements', 'margin'],
    idea: 'Not what you charge. What is left after delivering it — and which costs move with volume.',
    cards: [
      ['What is gross margin?', 'Revenue minus the cost of making it, divided by revenue. What is left over for everything else.'],
      ['Fixed vs variable costs?', 'Fixed stays the same as volume changes (rent). Variable grows with each sale (materials).'],
      ['What is contribution margin?', 'Price minus variable cost. What each sale contributes toward fixed costs.'],
      ['What is the breakeven point?', 'Fixed costs ÷ contribution margin per unit. How many you must sell to cover the basics.'],
      ['What is operating leverage?', 'How much of your cost is fixed. High fixed cost means profits swing hard both ways.'],
      ['Why do investors love software margins?', 'The next copy costs almost nothing, so extra revenue is almost all profit.'],
    ],
  },
  {
    id: 'unit-economics', phase: 'p3', title: 'Unit economics', builds: ['margins'],
    idea: 'Shrink the whole business down to one customer. If one loses money, a million lose a million times more.',
    cards: [
      ['What are unit economics?', 'The money made and spent on a single customer or order.'],
      ['What is CAC?', 'Customer acquisition cost. Sales and marketing spend ÷ new customers won.'],
      ['What is LTV?', 'Lifetime value. The margin you expect from a customer before they leave.'],
      ['What is a healthy LTV:CAC ratio?', 'About 3:1. Under 1:1 you lose money on every customer you win.'],
      ['What is CAC payback?', 'How many months of profit it takes to earn back what you spent winning the customer. Under 12 is strong.'],
      ['Why must LTV use margin, not revenue?', 'The part you spend delivering the service was never yours to keep.'],
      ['What is churn?', 'The rate customers leave.'],
      ['How does churn cap LTV?', 'Lifetime is roughly 1 ÷ churn. At 5% monthly churn, the average customer lasts 20 months. That is your ceiling.'],
    ],
  },
  {
    id: 'cash', phase: 'p3', title: 'Cash flow and runway', builds: ['statements'],
    idea: 'Companies rarely die of being unprofitable. They die of running out of cash on a Tuesday.',
    cards: [
      ['What is burn rate?', 'How much cash you lose per month.'],
      ['What is runway?', 'Cash ÷ monthly burn. Months until the account is empty.'],
      ['What is working capital?', 'Current assets minus current liabilities. The cash tied up in day-to-day operating.'],
      ['How can growth cause a cash crisis?', 'You pay for stock and staff first, and customers pay you later. Faster growth, bigger gap.'],
      ['Three ways to extend runway without layoffs?', 'Collect faster, pay slower, and charge annually upfront.'],
      ['What does "default alive" mean?', 'At your current growth and burn, you reach profit before the money runs out.'],
    ],
  },

  /* ─────────── Phase 4 · Entrepreneurship & Validation ─────────── */
  {
    id: 'pain', phase: 'p4', title: 'Find a monetizable pain', builds: ['scarcity', 'unit-economics'],
    idea: 'Start with a problem people already pay for or suffer through. Solutions are cheap. Real problems are rare.',
    cards: [
      ['Why start with the problem, not the solution?', 'A solution is only good relative to a problem someone actually has.'],
      ['Painkiller or vitamin?', 'A painkiller fixes something that hurts now, so it gets bought now. A vitamin is nice to have, so it waits forever.'],
      ['What makes a pain monetizable?', 'Someone with a budget already spends money or time on it, and you can find them.'],
      ['What is a workaround, and why does it matter?', 'A hack people built themselves. It proves the pain is real and shows you what to replace.'],
      ['What kills most startups?', 'Building something nobody needs.'],
      ['How do you size a market without a research report?', 'Count the people with the problem, multiply by what they already spend fixing it.'],
    ],
  },
  {
    id: 'discovery', phase: 'p4', title: 'Customer discovery', builds: ['pain'],
    idea: 'You cannot learn what people need by asking if they like your idea. Ask about their past, not your future.',
    cards: [
      ['What is the rule of "The Mom Test"?', 'Ask about their life, not your idea. Even your mom cannot lie about what she did last week.'],
      ['Name three questions that give you useless answers.', '"Would you buy this?" "Is this a good idea?" "What would you pay?" All invite polite guessing.'],
      ['Turn "Would you use this?" into a good question.', '"Tell me about the last time you had this problem. What did you do?"'],
      ['What is an early adopter?', 'Someone whose pain is bad enough that they already tried to fix it themselves.'],
      ['Why target early adopters first?', 'They put up with a rough product and tell you the truth.'],
      ['What is a customer segment?', 'A group with the same problem you can reach the same way.'],
      ['How many interviews before you trust a pattern?', 'Usually 10 to 20 in one segment. Stop when new ones stop surprising you.'],
    ],
  },
  {
    id: 'demand', phase: 'p4', title: 'Test demand, not opinions', builds: ['discovery'],
    idea: 'Enthusiasm is free. Make the test cost them something real: money, time, or their reputation.',
    cards: [
      ['What separates a strong signal from a weak one?', 'What it cost them. Money and time are strong. Compliments are free.'],
      ['What is a falsifiable hypothesis?', 'A prediction specific enough to fail. Metric, number, deadline — written down first.'],
      ['What is a smoke test?', 'Selling it before you build it, and counting who actually clicks buy.'],
      ['What is a concierge MVP?', 'Doing it by hand for a few customers before automating anything.'],
      ['What is the strongest proof of demand?', 'Someone paying you before the product exists.'],
      ['What is confirmation bias, and how do you fight it?', 'Only noticing evidence you are right. Fix: write down what result would kill the idea, before you look.'],
      ['Why are surveys weak evidence?', 'They measure what people say when saying it costs nothing.'],
    ],
  },
  {
    id: 'pmf', phase: 'p4', title: 'Product-market fit', builds: ['demand', 'unit-economics'],
    idea: 'Fit is not a feeling. It shows up as people sticking around and pulling the product out of you.',
    cards: [
      ['What is product-market fit?', 'A good market with a product that satisfies it. Demand pulls harder than you can push.'],
      ['What is the best number to check for fit?', 'Retention. Does the cohort curve flatten out instead of falling to zero.'],
      ['What is the 40% test?', 'Ask users how they would feel if the product disappeared. Over 40% "very disappointed" suggests fit.'],
      ['Name three signs you do not have fit.', 'Usage needs constant nudging, deals only close with heroics, churn eats your new sales.'],
      ['Why is scaling before fit dangerous?', 'You multiply a broken model and burn the cash you needed to fix it.'],
      ['What is a pivot?', 'Changing the approach while keeping what you learned. Usually the customer stays and the solution changes.'],
      ['What does "nail it then scale it" mean?', 'Prove one repeatable, profitable way to win a customer. Only then pour money on it.'],
    ],
  },

  /* ─────────── Phase 5 · Business Models & Strategy ─────────── */
  {
    id: 'revenue-model', phase: 'p5', title: 'How you make money', builds: ['pmf', 'margins'],
    idea: 'The revenue model is a design choice. It decides your cash timing, your customers, and your rivals.',
    cards: [
      ['What is a business model?', 'How you create value, deliver it, and keep some of it as cash.'],
      ['Name five revenue models.', 'Subscription, per-sale, marketplace take rate, usage-based, advertising.'],
      ['Why is recurring revenue worth more?', 'Last year\'s customers still pay this year, so it stacks and it is predictable.'],
      ['What is the chicken-and-egg problem?', 'A marketplace needs buyers to attract sellers and sellers to attract buyers. Fix: subsidise one side first.'],
      ['What is a take rate?', 'The cut a marketplace keeps on each transaction.'],
      ['What does freemium need to work?', 'Nearly free to serve the free users, and a clear reason to upgrade.'],
    ],
  },
  {
    id: 'pricing', phase: 'p5', title: 'Pricing and value capture', builds: ['revenue-model', 'prices'],
    idea: 'Price to the value they get, not the cost you paid. It is the fastest lever you own.',
    cards: [
      ['What is value-based pricing?', 'Charging based on what it is worth to the customer.'],
      ['What is wrong with cost-plus pricing?', 'It caps you at your own costs and ignores what people would happily pay.'],
      ['What is willingness to pay?', 'The most a customer would hand over rather than go without.'],
      ['Why is price the strongest profit lever?', 'A 1% price rise costs you nothing extra. A 1% volume rise does.'],
      ['Why have pricing tiers?', 'Different customers value it differently. Tiers let each pay closer to their own number.'],
      ['Nobody ever objects to your price. What does that mean?', 'You are too cheap.'],
    ],
  },
  {
    id: 'moats', phase: 'p5', title: 'Moats and defensibility', builds: ['revenue-model'],
    idea: 'Profit attracts copycats. You keep only what they cannot copy.',
    cards: [
      ['What is a moat?', 'Something that keeps competitors from taking your profits.'],
      ['What are network effects?', 'Every new user makes it better for the others. The leader pulls away.'],
      ['What are switching costs?', 'The time, money, and hassle of leaving you.'],
      ['What are economies of scale?', 'Bigger volume, lower cost per unit. The biggest player can price where others cannot survive.'],
      ['What is counter-positioning?', 'Doing it a way the incumbent cannot copy without wrecking their existing business.'],
      ['Why is "great technology" usually not a moat?', 'Code is copyable and engineers are hireable. It is a head start, not a wall.'],
      ['When is a brand a moat?', 'When the name alone makes people trust it enough to skip comparing.'],
    ],
  },
  {
    id: 'frameworks', phase: 'p5', title: 'Frameworks for sizing up a market', builds: ['moats'],
    idea: 'Borrowed lenses. Each one asks a question you would otherwise forget to ask.',
    cards: [
      ['What are Porter\'s five forces?', 'Rivalry, new entrants, substitutes, supplier power, buyer power. They decide if an industry is worth entering.'],
      ['Which of the five forces is most often underrated?', 'Buyer power. A few big customers can quietly set your price for you.'],
      ['What is jobs-to-be-done?', 'People "hire" a product to get a job done. Ask what job yours is hired for.'],
      ['Give the classic jobs-to-be-done example.', 'Nobody wants a drill. They want a hole. Actually, they want the shelf up.'],
      ['What is a value chain?', 'Every step from raw input to customer. Useful for spotting where the profit actually sits.'],
      ['What is positioning?', 'The one thing you want to own in a customer\'s head, relative to alternatives.'],
      ['What is the "who, what, how" of strategy?', 'Which customer, what value, how delivered. Strategy is choosing — and saying no to the rest.'],
      ['What does a SWOT actually get used for?', 'Fast internal-vs-external stocktake: strengths, weaknesses, opportunities, threats. Useful to start a conversation, not to end one.'],
    ],
  },
  {
    id: 'gtm', phase: 'p5', title: 'Go-to-market', builds: ['pricing', 'unit-economics'],
    idea: 'Distribution is not what happens after you build. Your price decides what sales motion you can afford.',
    cards: [
      ['What is a go-to-market strategy?', 'The repeatable way a specific customer finds you, decides, and buys.'],
      ['Why must price match the sales motion?', 'A salesperson costs more than a small contract can ever repay. Cheap products must sell themselves.'],
      ['What is channel-market fit?', 'Reaching customers where they already are, the way they already buy.'],
      ['Why measure CAC per channel?', 'A blended number hides that one channel prints money and another burns it.'],
      ['Funnel or loop — what is the difference?', 'A funnel pours people in the top with spend. A loop turns each customer into the next one.'],
      ['What is a beachhead strategy?', 'Win one narrow segment completely, then use it to take the next one.'],
      ['Why do channels stop working as you grow?', 'You use up the cheap audience, and the price of attention goes up.'],
    ],
  },

  /* ─────────── Phase 6 · Fundraising & Growth ─────────── */
  {
    id: 'valuation', phase: 'p6', title: 'Valuation basics', builds: ['time-value', 'unit-economics'],
    idea: 'A company is worth the cash it will throw off, adjusted for time and risk. Everything else is shorthand.',
    cards: [
      ['Pre-money vs post-money?', 'Pre-money is the value before the investment. Post-money is pre-money plus the money.'],
      ['You raise $2M at an $8M pre-money. What do investors own?', '20%. $2M of a $10M post-money.'],
      ['What is dilution?', 'Your ownership percentage shrinking when new shares are issued.'],
      ['Is dilution bad?', 'Not by itself. A smaller slice of a much bigger pie is the whole point.'],
      ['What is a valuation multiple?', 'Pricing a company as a multiple of a number — revenue, ARR, or profit — based on similar companies.'],
      ['What is discounted cash flow?', 'Estimate future cash, then discount it back to what it is worth today.'],
      ['Why do early valuations ignore DCF?', 'There is no cash to discount. Price comes from team, market size, traction, and how many investors want in.'],
    ],
  },
  {
    id: 'venture', phase: 'p6', title: 'How venture capital works', builds: ['valuation'],
    idea: 'A VC fund has its own math. Understand it and every question in the room makes sense.',
    cards: [
      ['Where does a VC\'s money come from?', 'Limited partners — pensions, endowments, family offices. The VC invests on their behalf.'],
      ['What is the power law in venture?', 'A tiny handful of investments pay for everything else.'],
      ['Why do VCs ask "how big can this get?"', 'Because a 2x winner cannot cover the many that go to zero. Each bet has to be able to return the whole fund.'],
      ['What is 2 and 20?', 'About 2% a year in management fees, plus 20% of the profits.'],
      ['When is venture capital the wrong fit?', 'When the business is steadily profitable but will never be huge. It is a fine business and a bad VC bet.'],
      ['What changes between seed and Series A?', 'Seed buys the team and the idea. Series A buys evidence: repeat revenue, retention, a channel that works.'],
    ],
  },
  {
    id: 'terms', phase: 'p6', title: 'Term sheets', builds: ['venture'],
    idea: 'Valuation is the headline. Control and preference are the story.',
    cards: [
      ['What is a SAFE?', 'Money now that turns into shares at the next priced round.'],
      ['What is a valuation cap?', 'The highest valuation at which your SAFE converts. It protects the early investor if the next round prices high.'],
      ['What is a liquidation preference?', 'Who gets paid first in a sale. 1x non-participating is the founder-friendly normal.'],
      ['What is participating preferred?', 'The investor takes their money back AND shares the rest. Double dipping. Push back.'],
      ['What is pro rata?', 'The right to keep investing later to hold their percentage.'],
      ['What is the option pool shuffle?', 'Carving the employee option pool out of the pre-money, so founders eat the dilution.'],
      ['Name two terms that matter more than valuation.', 'Board seats and veto rights.'],
    ],
  },
  {
    id: 'scale', phase: 'p6', title: 'Scaling operations', builds: ['gtm', 'cash', 'pmf'],
    idea: 'Scaling is repetition. Only repeat something you already proved works.',
    cards: [
      ['What has to be true before you scale?', 'A repeatable way to win customers profitably, and retention that holds.'],
      ['Growth vs scale?', 'Growth adds revenue by adding just as much cost. Scale adds revenue faster than cost.'],
      ['What breaks first when a company grows?', 'Communication. What worked at 10 people quietly fails around 40.'],
      ['Why is hiring the riskiest cost?', 'It is the hardest to undo. Burn goes up immediately, output goes up slowly.'],
      ['What is a growth ceiling?', 'When more spend stops producing more growth — usually a saturated channel or churn matching sales.'],
      ['Why does churn hurt more as you get bigger?', 'It is a percentage of a bigger base. Eventually departures cancel everything sales adds.'],
    ],
  },
  {
    id: 'org', phase: 'p6', title: 'Building the organisation', builds: ['scale'],
    idea: 'Past a certain size the company is the product. What you build is a machine that decides without you.',
    cards: [
      ['What is delegation, really?', 'Handing over the decision, not just the task.'],
      ['What is a span of control?', 'How many people report to one manager. Past roughly seven, quality drops.'],
      ['What is the first sign you need process?', 'The same mistake happening twice in different corners of the company.'],
      ['What is culture, in practical terms?', 'What gets rewarded and what gets tolerated. Not the poster.'],
      ['Why hire for the stage you are in?', 'Big-company operators often need structure that does not exist yet. Early people need to work without it.'],
      ['What is a RACI, in one line?', 'Who is Responsible, Accountable, Consulted, Informed. It exists to kill "I thought you had it".'],
      ['Why does founder time become the bottleneck?', 'Everything routes through the person who knows everything. Fix it by transferring decisions, not by working later.'],
    ],
  },
];

/* Flat card list, tagged with its principle and phase name. */
export const CURRICULUM_CARDS = PRINCIPLES.flatMap((p) => {
  const phase = PHASES.find((x) => x.id === p.phase);
  return p.cards.map(([front, back]) => ({ front, back, category: phase.name, principle: p.id }));
});
