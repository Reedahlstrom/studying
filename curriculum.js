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

  /* ─────────── Added principles: the domains the first pass missed ─────────── */
  {
    id: 'uncertainty', phase: 'p1', title: 'Deciding under uncertainty', builds: ['behavior', 'margin'],
    idea: 'You never have enough information. Judge the bet, not the outcome.',
    cards: [
      ['What is expected value?', 'Each outcome times its probability, added up. The average result if you could run it many times.'],
      ['A bet pays $900 on a 20% chance and costs $100. Should you take it?', 'Yes. Expected value is 0.2 × $900 = $180 against a $100 cost.'],
      ['What is resulting?', 'Judging a decision by how it turned out. Good decisions lose sometimes; bad ones win sometimes.'],
      ['What is a base rate?', 'How often something happens across all similar cases. Start there before adjusting for your specifics.'],
      ['Most restaurants fail in five years. Why does that matter for your restaurant?', 'It is the base rate. Your plan has to explain what makes you different, or you inherit the odds.'],
      ['What is an asymmetric bet?', 'Small capped downside, large uncapped upside. Worth taking even at low odds.'],
      ['What is a one-way door decision?', 'One you cannot reverse. Slow down for those; move fast on the reversible ones.'],
      ['Why is survivorship bias dangerous in business advice?', 'You only hear from the winners. The same strategy may have killed a hundred companies you never heard of.'],
      ['What does "strong opinions, loosely held" protect against?', 'Both paralysis and stubbornness. Decide fast, then update when evidence arrives.'],
    ],
  },
  {
    id: 'capital', phase: 'p3', title: 'Debt, equity, and the cost of capital', builds: ['statements', 'time-value'],
    idea: 'Money has a price. Which kind you take decides who gets paid and who decides.',
    cards: [
      ['What is the difference between debt and equity?', 'Debt is borrowed and must be repaid with interest. Equity is sold and never repaid, but the buyer owns part of the company.'],
      ['Which is cheaper, debt or equity, and why?', 'Debt. Lenders take less risk and get paid first, so they accept a lower return than owners demand.'],
      ['What is cost of capital?', 'The return you must earn to justify the money you used. Below it, you destroy value even while showing a profit.'],
      ['What is financial leverage?', 'Using borrowed money to increase returns. It magnifies gains and losses equally.'],
      ['When is debt the right choice?', 'When cash flow is predictable enough to service it, and you would rather pay interest than give up ownership.'],
      ['When is debt dangerous?', 'When revenue is lumpy or unproven. Interest is due whether or not the month went well.'],
      ['What is a covenant?', 'A condition in a loan — a ratio to maintain, a limit on new debt. Breaking one can make the loan due immediately.'],
      ['What is venture debt, and when does it fit?', 'A loan to a company that has already raised equity, used to extend runway between rounds without extra dilution.'],
      ['What is bootstrapping, in cost-of-capital terms?', 'Funding from revenue. The most expensive capital in time, the cheapest in ownership.'],
    ],
  },
  {
    id: 'kpis', phase: 'p3', title: 'Reading the numbers in practice', builds: ['unit-economics', 'bookkeeping'],
    idea: 'A dashboard full of numbers is not insight. A few ratios, tracked over time, is.',
    cards: [
      ['What makes a metric actionable?', 'Someone can change it with a decision this week. Otherwise it is a scoreboard, not a lever.'],
      ['What is a vanity metric? Give two.', 'One that always goes up and changes no decision — total registered users, cumulative downloads, page views.'],
      ['What is a cohort?', 'A group defined by when they started. Comparing cohorts shows whether the product is getting better or the market is just getting bigger.'],
      ['Why does a cohort chart beat a total-users chart?', 'Totals hide churn — new signups mask departures. Cohorts show whether people stay.'],
      ['What is a leading vs lagging metric?', 'Leading moves before the outcome (trials started). Lagging confirms it after (revenue). Manage on leading, report on lagging.'],
      ['Revenue is up 10% and gross margin is down 5 points. What should you look at first?', 'What you discounted or what got more expensive to deliver. You may be buying revenue.'],
      ['What is the danger of averages in metrics?', 'They hide the distribution. Average revenue per user says nothing if 5% of users are 80% of revenue.'],
      ['Name the three numbers a small business owner should know weekly.', 'Cash in the bank, gross margin, and sales booked. Everything else can wait a month.'],
    ],
  },
  {
    id: 'selling', phase: 'p5', title: 'Selling and negotiating', builds: ['gtm'],
    idea: 'Selling is diagnosis before prescription. Negotiating is knowing your alternative.',
    cards: [
      ['What is the most common mistake in a sales conversation?', 'Talking. Pitching before you understand what the buyer is trying to fix.'],
      ['What is a qualified lead?', 'Someone with the problem, the budget, the authority to buy, and a reason to act now.'],
      ['What does BANT stand for?', 'Budget, Authority, Need, Timeline — the four things that decide whether a deal is real.'],
      ['What is a sales pipeline?', 'Deals grouped by stage, each with a probability. It forecasts revenue and shows where deals die.'],
      ['Your pipeline is full and nothing closes. What is the likely cause?', 'No urgency — the buyer has a need but no deadline. Find the cost of waiting or disqualify.'],
      ['What is BATNA?', 'Best alternative to a negotiated agreement — what you do if this deal dies. It sets your walk-away point.'],
      ['Why is knowing your BATNA the whole game?', 'Your power in a negotiation comes from being able to leave, not from arguing well.'],
      ['What is anchoring in a negotiation?', 'The first number reframes the whole discussion. Whoever anchors credibly usually captures more.'],
      ['Why negotiate on interests rather than positions?', 'Positions are what each side demands; interests are why. Different interests can often both be satisfied.'],
      ['A buyer says "your price is too high." What should you do first?', 'Ask what they are comparing it to. It is usually a value problem or a budget problem, and the fix differs.'],
    ],
  },
  {
    id: 'operations', phase: 'p5', title: 'Operations and delivery', builds: ['margins'],
    idea: 'Strategy is what you promise. Operations is whether you can keep promising it at volume.',
    cards: [
      ['What is a bottleneck?', 'The slowest step. It sets the pace of the whole system.'],
      ['Why is improving a non-bottleneck usually wasted effort?', 'Output is capped by the bottleneck. Speeding up anything else just builds a bigger queue in front of it.'],
      ['What is throughput?', 'Finished units per unit of time. Not how busy people are — how much actually comes out.'],
      ['What is inventory, in cash terms?', 'Money you have already spent, sitting on a shelf until someone buys it.'],
      ['What is just-in-time, and what is its risk?', 'Holding minimal inventory and restocking on demand. It frees cash but breaks badly when supply is disrupted.'],
      ['What is a lead time?', 'How long from order to delivery. Long lead times force you to forecast, and forecasts are usually wrong.'],
      ['Why does quality get cheaper the earlier you catch a defect?', 'Fixing it at the source costs one step. Fixing it after delivery costs the rework, the shipping, and the customer.'],
      ['What is capacity utilisation, and why is 100% a warning sign?', 'The share of capacity in use. At 100% there is no slack, so any hiccup becomes a delay everywhere.'],
    ],
  },
  {
    id: 'captable', phase: 'p6', title: 'Cap tables and dilution math', builds: ['valuation', 'terms'],
    idea: 'Ownership is arithmetic. Do it before the meeting, not after.',
    cards: [
      ['What is a cap table?', 'The list of who owns what: shares, options, and what converts later.'],
      ['You own 100%. Seed takes 20%, then Series A takes 25%. What do you own?', '60%. Each round multiplies: 100% × 0.80 × 0.75.'],
      ['Why does dilution multiply rather than add?', 'Each round takes a share of what remains, not of the original. Two 20% rounds leave 64%, not 60%.'],
      ['You own 60% and raise $3M at a $12M pre-money. What do you own after?', '48%. Post-money is $15M, the investor takes 20%, and 60% × 0.80 = 48%.'],
      ['What is an option pool, and who pays for it?', 'Shares reserved for employees. Created pre-money, existing shareholders — mostly founders — absorb the dilution.'],
      ['What is fully diluted ownership?', 'Your percentage if every option and convertible turned into shares today. It is the only number worth quoting.'],
      ['A $5M investment at $20M post is what ownership?', '25%. $5M ÷ $20M.'],
      ['Investor put in $5M for 25% with a 1x non-participating preference. The company sells for $16M. What do they get?', '$5M. They take the greater of their preference or 25% of $16M ($4M).'],
      ['Same deal, but participating preferred. What do they get?', '$7.75M. $5M back, then 25% of the remaining $11M.'],
      ['Why can founders make nothing on a sale that looks like a win?', 'Preferences pay investors first. If the preference stack exceeds the sale price, common shares get what is left — sometimes nothing.'],
    ],
  },
  {
    id: 'people', phase: 'p6', title: 'Hiring and equity compensation', builds: ['org'],
    idea: 'Your first twenty hires are the company. Equity is how you pay for people you cannot afford.',
    cards: [
      ['What is vesting?', 'Earning your equity over time instead of receiving it all at once. Four years with a one-year cliff is standard.'],
      ['What is a cliff?', 'The minimum time before any equity vests — usually one year. Leave before it and you get nothing.'],
      ['What is a strike price?', 'The price an option lets you buy a share at. Your gain is the sale price minus the strike.'],
      ['An employee has 10,000 options at a $1 strike and the company sells at $6. What is it worth before tax?', '$50,000. 10,000 × ($6 − $1).'],
      ['Why is "1% of the company" a meaningless offer on its own?', 'Without the valuation, the dilution to come, and the strike price, a percentage has no dollar meaning.'],
      ['What is the cost of a bad hire?', 'Their salary, the work they broke, the time to replace them, and the good people who left because of them.'],
      ['Why hire slowly and fire quickly?', 'Hiring mistakes are expensive and compound through the culture. Keeping one is a decision you make every day.'],
      ['What signal does a reference check actually give you?', 'How someone worked, not whether they are nice. Ask what the person needed managing on.'],
      ['Why does the first non-founder hire matter disproportionately?', 'They set the bar for everyone after them, and they are the proof that anyone else should join.'],
    ],
  },
  {
    id: 'exits', phase: 'p6', title: 'Exits and acquisitions', builds: ['valuation', 'captable'],
    idea: 'Companies are bought, not sold. Understand why a buyer buys.',
    cards: [
      ['What are the realistic exits for a private company?', 'Acquisition, an IPO, a buyout, or paying the owners forever. Most are acquisitions.'],
      ['Why do acquirers buy companies?', 'To buy revenue, technology, a team, a customer base, or to remove a threat. The reason sets the price.'],
      ['What is an acqui-hire?', 'Buying a company mainly for its people. Usually priced per engineer, and usually a soft landing rather than a win.'],
      ['What is a strategic vs a financial buyer?', 'A strategic buyer wants a fit with their business and pays for synergy. A financial buyer wants returns and pays off the numbers.'],
      ['What is an earn-out?', 'Part of the price paid later if targets are hit. It bridges a disagreement about value, and it often disappoints.'],
      ['What is due diligence?', 'The buyer verifying everything you claimed. Messy books and unsigned contracts kill deals here.'],
      ['Why does "we are keeping our options open" weaken your position in a sale?', 'Buyers pay more when they fear losing to another buyer. One interested party is a price ceiling.'],
      ['What is an IPO, in one line?', 'Selling shares to the public. It is a financing event and a liquidity event, not a finish line.'],
    ],
  },
];

/* ══════════════════════════════════════════════════════════════
   Applied layer.

   The definitions above give you the vocabulary. These make you use
   it: compute the number, diagnose the situation, tell apart the two
   things people confuse, and connect one principle to another.
   ══════════════════════════════════════════════════════════════ */
export const APPLIED = {
  /* ── Phase 1 ── */
  scarcity: [
    ['You spend a Saturday on a client job for $400. You would have earned $250 doing something else. What did the day really net you?', '$150. The alternative you gave up is part of the cost.'],
    ['You have already spent $30k on a product nobody wants. Finishing costs $10k more. What matters?', 'Only the $10k against what finishing is worth. The $30k is gone either way.'],
    ['Two projects, both good, one team. What is the real cost of picking the first?', 'Everything the second would have earned. That is the number to beat, not zero.'],
    ['A "free" partnership costs 10 hours a week. When is it too expensive?', 'When those hours would earn more elsewhere. Free of cash is not free of capacity.'],
    ['A subscription you forgot about costs $40/month. What is the annual cost of not cancelling?', '$480, plus whatever that money would have earned. Small recurring leaks compound.'],
    ['Why do businesses keep failing product lines alive?', 'Sunk cost and identity. The money spent and the story told both argue against admitting it.'],
  ],
  margin: [
    ['A hotel room costs $180/night to build and $15/night to clean. A guest offers $60 for tonight. Take it?', 'Yes. The build cost is sunk; $60 beats the $15 marginal cost, so it adds $45 tonight.'],
    ['When would you refuse that $60 room anyway?', 'If discounting trains regulars to wait for cheap rooms. The marginal sale can cost you the full-price ones.'],
    ['Your average cost per unit is $8 and marginal cost is $3. What price floor matters for one extra order?', '$3. Averages include costs that will not change with the order.'],
    ['You add a second delivery van. Revenue rises 20%, costs rise 35%. What does that tell you?', 'You are past the useful margin — the next unit costs more than it brings in.'],
    ['A salesperson costs $6k/month and brings in $9k of gross profit. Hire a second?', 'Only if the second finds similar customers. Marginal, not average — the easy accounts are already taken.'],
    ['Why is "we will make it up in volume" usually wrong?', 'If contribution margin is negative, every extra unit loses money. Volume multiplies the loss.'],
  ],
  'supply-demand': [
    ['A competitor exits and your prices rise. What moved?', 'Supply fell. Same demand, fewer sellers, higher equilibrium price.'],
    ['Your prices rise and you sell just as much. What does that tell you?', 'Demand is inelastic — you had pricing power you were not using.'],
    ['Demand for your product jumps every December. Is that a shift in demand or a move along the curve?', 'A shift. Price did not change; the season did.'],
    ['Concert tickets sell out in minutes and resell for triple. What does that say about the original price?', 'It was below equilibrium. The shortage and the resale market are the price signal you ignored.'],
    ['You raise price 10% and volume falls 25%. Was it worth it?', 'No. Revenue fell — demand was elastic. Check margin before concluding, but the direction is bad.'],
    ['Name two things that make your customers less price-sensitive.', 'No good substitute, and the purchase being small relative to what it protects or earns them.'],
  ],
  prices: [
    ['Rent control keeps rents below market. Predict three effects.', 'A shortage of units, less new building, and landlords under-maintaining what exists.'],
    ['A minimum wage above the market rate for a role. Predict the effect.', 'Fewer of those jobs, more automation, or more hours cut. The wage floor is a price floor.'],
    ['Your supplier raises prices 20% and says it is temporary. What does that signal?', 'Their input is scarce or demand rose. Temporary or not, it tells you to look for substitutes now.'],
    ['A company pays bonuses for closed deals only. What behaviour follows?', 'Deals get closed and customers get over-promised. You get what you pay for, including the part you did not want.'],
    ['Free shipping over $50 — what is that price signal doing?', 'Moving the anchor. It reframes the shipping cost as a reward for spending more.'],
    ['Why is a long queue a business failure, not a success sign?', 'It is unpriced demand. You are giving away in waiting time what you could capture in price or capacity.'],
  ],
  behavior: [
    ['Why does a $99 price beat $100 by more than a dollar?', 'The left digit anchors. Buyers read it as "ninety-something," not "one hundred."'],
    ['You offer three tiers and want most people on the middle one. How do you design the top tier?', 'Expensive enough to make the middle look reasonable. The top tier is a reference point as much as a product.'],
    ['A free trial requires a card up front. Which two biases is that using?', 'The endowment effect once they are using it, and friction — cancelling takes an action most will not take.'],
    ['Your checkout adds a fee on the final screen. Why does it cost you more sales than the same amount added earlier?', 'It breaks the anchor and reads as a loss. Loss aversion hits harder than the number justifies.'],
    ['Why does "8,000 businesses use this" outperform a list of features?', 'Social proof. Under uncertainty, people copy the crowd rather than evaluate.'],
    ['A sign-up form goes from six fields to three. What usually happens?', 'Conversion rises more than the three fields seem to justify. Small friction has outsized effects.'],
    ['Why is a small, certain discount often more persuasive than a large lottery-style prize?', 'Certainty is valued above expected value. People overweight small probabilities and still prefer the sure thing.'],
  ],
  'time-value': [
    ['$1,000 growing 10% a year for three years. What is it worth?', '$1,331. Each year compounds on the last, not on the original.'],
    ['At 6% annual growth, roughly how long to double?', '12 years. 72 ÷ 6.'],
    ['You can take $10,000 today or $11,000 in two years. Money earns 8%. Which?', 'Today. $10,000 at 8% for two years is $11,664.'],
    ['Why does a customer paying annually up front change your business, not just your cash?', 'You get a year of cash to spend on growth, and they are far less likely to churn mid-year.'],
    ['Why do savers get hurt when rates sit below inflation?', 'Their money grows in nominal terms and shrinks in real terms. The interest does not cover the price rise.'],
    ['You lend a friend $5,000 interest-free for five years. Inflation is 3%. What did that cost you?', 'Roughly $700 of purchasing power, plus everything the money could have earned.'],
  ],

  /* ── Phase 2 ── */
  'money-inflation': [
    ['Inflation is 4% and your investments returned 7%. What is your real return?', 'About 3%. The nominal return minus inflation.'],
    ['Your supplier holds prices flat during 5% inflation. What are they really doing?', 'Cutting their real price by 5% — and probably absorbing a margin hit they will claw back later.'],
    ['You signed a five-year fixed-rate loan and inflation runs hot. Good or bad for you?', 'Good. You repay with money worth less than what you borrowed.'],
    ['Why do menu prices lag inflation?', 'Changing prices costs effort and annoys customers, so businesses wait and then move in a jump.'],
    ['Inflation is 6% and you give a 6% raise. What did the employee gain?', 'Nothing in real terms. It is a hold, not a raise.'],
  ],
  output: [
    ['A country produces the same goods but prices rose 5%. What happened to nominal and real GDP?', 'Nominal GDP rose 5%; real GDP is flat. Nothing more was actually produced.'],
    ['Your team ships the same output with two fewer people. What rose?', 'Productivity — output per hour. That is the only kind of growth that lasts.'],
    ['Why can a country grow GDP and see living standards fall?', 'If population grows faster than output, GDP per person falls. Totals hide the per-head picture.'],
    ['A factory rebuilds after a flood and GDP rises. Is the country better off?', 'No. Replacing what was destroyed counts as activity but restores nothing that was not already there.'],
    ['Which raises long-run output more: everyone working an extra hour, or a tool that makes each hour 10% more productive?', 'The tool. Hours are capped; productivity compounds.'],
  ],
  cycles: [
    ['Building permits fall for three straight months. What are you being told?', 'A slowdown is likely coming. Permits lead construction, employment, and spending.'],
    ['Unemployment is still low but new orders are falling. Where are you in the cycle?', 'Likely near a peak. Orders lead; employment lags.'],
    ['Why should a business hold more cash going into a downturn?', 'Credit tightens exactly when revenue dips. Cash buys survival and cheap assets.'],
    ['What kinds of business hold up best in a recession?', 'Those selling necessities, repairs, and things that save customers money.'],
    ['Your industry booms for four years straight. What should that make you consider?', 'That the cycle is not repealed. Plan the downturn while the good times pay for it.'],
  ],
  policy: [
    ['The Fed raises rates 2 points. Trace it to your mortgage and your job.', 'Borrowing costs rise, housing and investment slow, hiring cools. Rates reach the real economy through credit.'],
    ['Rates rise. What happens to startup valuations, and why?', 'They fall. Safe assets pay more, so investors demand higher returns and pay less for risky future cash flows.'],
    ['Government spends heavily while the economy is already at full employment. Likely result?', 'Inflation rather than extra output. There is no spare capacity to absorb the demand.'],
    ['Why can a central bank cut rates and see nothing happen?', 'If nobody wants to borrow, cheaper credit changes little. Policy pushes on a string in a slump.'],
    ['Cutting rates helps borrowers. Who does it hurt?', 'Savers, retirees on fixed income, and anyone holding cash. Every policy has a losing side.'],
  ],
  trade: [
    ['You are better than your assistant at everything, including admin. Should you still delegate admin?', 'Yes. Comparative advantage — your hour is worth more on the work only you can do.'],
    ['The dollar strengthens 10%. What happens to a US exporter?', 'Their goods cost foreigners 10% more, so volume falls or margin does.'],
    ['A 25% tariff on imported steel. Who ultimately pays?', 'Domestic buyers, through higher prices — including manufacturers who use steel.'],
    ['Your supplier is overseas and your currency weakens. What happens to your margin?', 'It falls. Your inputs cost more in your own currency while your selling price has not moved.'],
    ['Why is a trade deficit not automatically bad?', 'It means you bought more than you sold, financed by capital coming the other way. The question is what you did with it.'],
  ],

  /* ── Phase 3 ── */
  statements: [
    ['Revenue $1M, COGS $300k, operating expenses $500k. What is gross margin and operating profit?', 'Gross margin 70%. Operating profit $200k.'],
    ['A company books a $200k sale in March and gets paid in June. When does it show up on each statement?', 'Income statement in March. Cash flow statement in June. That gap is working capital.'],
    ['Profit is $100k and cash fell $50k. Name two things that could explain it.', 'Receivables grew, or you bought inventory or equipment. Profit and cash move on different clocks.'],
    ['Which statement tells you if a business can pay salaries next month?', 'The cash flow statement, plus the cash on the balance sheet. Profit does not pay wages.'],
    ['A company capitalises a cost instead of expensing it. What happens to this year\'s profit?', 'It rises — the cost moves to the balance sheet and is spread over future years.'],
    ['Assets $800k, liabilities $500k. What is equity, and what does it mean?', '$300k. That is what owners would have left if everything sold at book value and debts were paid.'],
    ['Why can a growing, profitable company still go bankrupt?', 'It runs out of cash before the profit arrives. Insolvency is a cash event.'],
  ],
  bookkeeping: [
    ['Current assets $150k, current liabilities $100k. What is the current ratio and does it worry you?', '1.5. Generally healthy — it can cover the next year of obligations.'],
    ['You spend $60k and get back $75k. What is the ROI?', '25%. $15k gain on $60k invested.'],
    ['Equipment costs $50k and lasts five years. What hits the income statement each year?', '$10k of depreciation. The cash left in year one; the expense is spread.'],
    ['Why do investors distrust EBITDA for capital-heavy businesses?', 'It ignores depreciation and interest — the real costs of the machines and the debt that bought them.'],
    ['Inventory turns 12 times a year vs 3. What does that difference tell you?', 'The faster one converts stock to cash four times as often, so it needs far less working capital.'],
    ['Where does a loan repayment show up on the income statement?', 'Only the interest does. The principal is a balance-sheet movement, not an expense.'],
  ],
  margins: [
    ['You sell at $100, variable cost $60, fixed costs $20k/month. How many units to break even?', '500 units. $20,000 ÷ $40 contribution.'],
    ['Same business. What is profit at 800 units?', '$12,000. 800 × $40 = $32,000 contribution, minus $20,000 fixed.'],
    ['You cut price from $100 to $90 with $60 variable cost. How much more volume do you need to stand still?', 'A third more. Contribution drops from $40 to $30, so 4 units now do the work of 3.'],
    ['A 10% price rise with no volume loss, at 40% gross margin. What happens to gross profit?', 'It rises 25%. The extra price is pure margin.'],
    ['A restaurant and a software company both make $1M. Which is more fragile to a 15% revenue drop, and why?', 'The restaurant. High fixed costs mean profit falls much faster than revenue.'],
    ['Your gross margin fell from 55% to 48% while revenue grew. What are the two suspects?', 'Discounting to get the growth, or delivery costs rising. Both mean the growth cost more than it looks.'],
  ],
  'unit-economics': [
    ['You charge $50/month at 80% gross margin. CAC is $600. What is the payback period?', '15 months. $40 of monthly gross profit into $600.'],
    ['Monthly churn is 4%. What is the average customer lifetime?', '25 months. 1 ÷ 0.04.'],
    ['Same customer: $40/month margin, 25-month life, $600 CAC. What is LTV and the ratio?', 'LTV $1,000, so 1.67:1. Below the 3:1 benchmark — it works, barely.'],
    ['You spent $30k on marketing and won 60 customers. What is CAC?', '$500.'],
    ['Churn improves from 5% to 3% monthly. What happens to LTV?', 'It rises about 67%. Lifetime goes from 20 to 33 months on the same margin.'],
    ['Blended CAC is $400. Paid ads are $900 and referrals are $50. What should you do?', 'Grow referrals and fix or cut paid. The blend was hiding a channel that loses money.'],
    ['Why can a business with great LTV:CAC still be a bad business?', 'If payback takes three years, growth eats cash faster than the customers return it.'],
    ['Your CAC is fine but only for the first 100 customers. What should you expect next?', 'Rising CAC. The cheapest, most motivated buyers always come first.'],
  ],
  cash: [
    ['$400k in the bank, burning $50k/month, then you raise $600k. What is the runway?', '20 months. $1M ÷ $50k.'],
    ['Same company wants 24 months of runway. How much must burn fall to?', 'About $42k/month. $1M ÷ 24.'],
    ['You collect in 60 days and pay suppliers in 30. What does growth do to your cash?', 'Drains it. You fund a month of every sale, so faster growth digs a deeper hole.'],
    ['Which extends runway more: a 10% revenue rise or a 10% cost cut, at $100k revenue and $150k costs?', 'The cost cut — $15k against $10k. Cuts act on the bigger number and act immediately.'],
    ['You are offered 2% off for paying in 10 days instead of 30. Is it worth it?', 'Only if that cash is not doing more elsewhere — 2% for 20 days is a very high annualised return, so usually yes.'],
    ['Why do founders raise when they do not need money?', 'Terms are best when you have leverage. Raising with three months of runway left is negotiating from weakness.'],
  ],

  /* ── Phase 4 ── */
  pain: [
    ['A customer built a 12-tab spreadsheet to manage something. What have you found?', 'A validated problem and a specification. The spreadsheet shows exactly what to replace.'],
    ['"Everyone has this problem." Why is that a warning?', 'If everyone has it and nobody paid to solve it, it does not hurt enough. Narrow pain beats broad annoyance.'],
    ['How do you tell a vitamin from a painkiller in one question?', 'Ask what they do about it today. Painkillers already have a budget line or a workaround.'],
    ['5,000 clinics spend $400/month on a workaround. What is your realistic market?', '$24M a year of demonstrated spend — a bottom-up number you can defend.'],
    ['A prospect loves it but says "next quarter." What did you learn?', 'The pain is real but not urgent. No deadline means no deal.'],
  ],
  discovery: [
    ['Rewrite "Do you think people would pay for this?" into a question worth asking.', '"What have you paid for to solve this, and what did it cost you?"'],
    ['Ten interviews, everyone was positive, nobody has bought. What went wrong?', 'You asked about the idea, not their behaviour. Enthusiasm is free.'],
    ['A customer says "I would definitely use that." How do you test it in the same conversation?', 'Ask for something costly — a deposit, a pilot date, an intro to their boss.'],
    ['Why interview within one narrow segment before widening?', 'Patterns only appear when the people share a problem. Mixed segments give you noise.'],
    ['What does it mean when interviews stop surprising you?', 'You have found the pattern. Stop interviewing and start testing whether they will pay.'],
  ],
  demand: [
    ['Rank these: 200 email signups, 5 paid pre-orders, 40 survey yeses.', 'Pre-orders first by a distance, then signups, then the survey. Rank by what it cost them.'],
    ['Write a falsifiable version of "the landing page will do well."', '"At least 5% of 500 visitors click Buy within two weeks." A number, a threshold, a deadline.'],
    ['Your smoke test converts 0.4%. What have you learned?', 'Either the demand is not there or the message is wrong. Change one thing and rerun before concluding.'],
    ['Why does a concierge MVP beat building the product first?', 'You prove people want the outcome before paying to automate it — and you learn what to automate.'],
    ['A pilot customer wants it free "to test." How should you read that?', 'As a weak signal. Free pilots measure curiosity; a paid one measures need.'],
  ],
  pmf: [
    ['Cohort retention flattens at 40% after month three. Good or bad?', 'Good — a flattening curve means a core that keeps using it. The level matters less than the flattening.'],
    ['Retention decays to near zero by month six. What does that mean for growth spend?', 'Stop. You are filling a leaking bucket and paying for the water.'],
    ['Every deal closes only after the founder joins the call. What does that tell you?', 'No fit yet — you have founder-market fit, not product-market fit. It will not scale.'],
    ['Sales grow 20% a month and churn is 8% a month. What happens eventually?', 'Growth stalls. Churn compounds against a bigger base until it cancels new sales.'],
    ['You have fit in one segment and not another. What should you do?', 'Go deeper in the one that works. Fit is per-segment, and diluting focus loses the segment you had.'],
    ['Name the cheapest signal that you are losing fit.', 'Support tickets and cancellations telling the same story twice. Listen before the metrics move.'],
  ],

  /* ── Phase 5 ── */
  'revenue-model': [
    ['Same product sold once for $1,200 or monthly at $60. Which builds a more valuable company, and why?', 'The subscription. $720/year that recurs compounds and is valued at a higher multiple than one-off sales.'],
    ['A marketplace takes 15% and sellers start transacting off-platform. What is the fix?', 'Give them a reason to stay in it — payments, protection, discovery — or lower the take rate.'],
    ['Your free tier is 95% of usage and 2% convert. When is that fine, and when is it fatal?', 'Fine if serving free users costs almost nothing. Fatal if they consume real support or infrastructure.'],
    ['Why does usage-based pricing align you with the customer better than a flat fee?', 'You only get more when they get more. It also means your revenue falls when they have a bad quarter.'],
    ['You sell to consumers at $10/month and to businesses at $500/month. Which needs a salesperson?', 'Only the business one. A $10 product must sell itself.'],
  ],
  pricing: [
    ['Your software saves a customer $50k a year. What is wrong with pricing it at $200/month?', 'You are capturing 5% of the value you create. The customer pockets the rest.'],
    ['Costs are $40 and you price at $60 for a 50% markup. What is the flaw?', 'It ignores what the buyer would pay. Cost-plus caps you at your own inefficiency.'],
    ['At 30% net margin, which raises profit more: 5% more customers or a 5% price rise?', 'The price rise. Extra customers bring extra costs; extra price does not.'],
    ['Everyone accepts your quote immediately. What should you change?', 'Raise the price. Zero friction means you are under the market.'],
    ['Two segments value your product very differently. How do you capture both without one price?', 'Tiers, usage bands, or a version with fewer features. Let each self-select.'],
    ['You raise prices for new customers only. What is the trade-off?', 'You protect goodwill and revenue today, but you carry a legacy base at old economics forever.'],
  ],
  moats: [
    ['Two food delivery apps, same city, same prices. Where does the moat actually come from?', 'Density. More restaurants attract more diners, which attracts more restaurants — a local network effect.'],
    ['Your product stores three years of a customer\'s data. What moat is that?', 'Switching costs. Leaving means losing history and retraining the team.'],
    ['A competitor copies your feature in a month. What did you actually have?', 'A feature, not a moat. Ask what compounds instead — data, scale, network, or brand.'],
    ['Why can a big incumbent fail to copy a cheaper model?', 'Counter-positioning — copying it would cannibalise the profitable business they already have.'],
    ['You have the lowest costs in the industry. When does that stop being a moat?', 'When the advantage comes from effort rather than structure. Scale and process persist; hustle does not.'],
  ],
  frameworks: [
    ['One customer is 60% of your revenue. Which of the five forces should worry you?', 'Buyer power. They can set your price and your roadmap, and losing them ends you.'],
    ['An industry with no entry barriers and identical products. What happens to profits?', 'They get competed to near zero. Rivalry plus easy entry is the worst combination to enter.'],
    ['Apply jobs-to-be-done to a milkshake bought at 7am.', 'It is hired to make a boring commute bearable and to last. Its competitors are bananas and bagels, not other milkshakes.'],
    ['Where in a value chain does the profit usually sit?', 'At the step with the least competition and the most customer lock-in — often distribution or the brand, rarely manufacturing.'],
    ['Write a positioning statement in one sentence for a product you would sell.', 'For [specific customer] who [problem], we are the [category] that [single differentiator].'],
  ],
  gtm: [
    ['A $30/month product and a salesperson costing $8k/month. How many customers must they close monthly just to pay for themselves?', 'About 267 — and they must keep closing them. That price cannot fund human selling.'],
    ['Same salesperson selling a $20k contract. How many deals to justify the cost?', 'Roughly one every two months at full margin. This is what human selling is for.'],
    ['Facebook ads at $300 CAC, referrals at $40, conferences at $1,200. Where do you put the next dollar?', 'Referrals — but check whether they scale. The cheapest channel is often the smallest.'],
    ['Your CAC rose 60% in two quarters with the same spend. What is the likely cause?', 'Channel saturation or rising auction prices. The cheap audience is used up.'],
    ['Describe a growth loop for a document tool.', 'Users share documents with non-users, who must sign up to view, and some of them create their own.'],
    ['Why win one narrow segment completely before expanding?', 'References, word of mouth, and a product that fits deeply. Diluted focus wins nobody.'],
  ],

  /* ── Phase 6 ── */
  valuation: [
    ['A company with $2M ARR trades in a market paying 6x revenue. What is the implied value?', '$12M.'],
    ['Same company, but growing 15% a month rather than 15% a year. What changes?', 'The multiple. Growth rate drives it more than the revenue does.'],
    ['You raise $1M at a $4M pre-money. What percentage did you sell?', '20%. $1M of a $5M post-money.'],
    ['You need $1M and want to give up no more than 15%. What pre-money must you hold?', 'At least $5.67M. $1M ÷ 0.15 = $6.67M post.'],
    ['Why is a higher valuation not automatically the better deal?', 'It sets a bar the next round has to clear, and the terms attached may cost more than the dilution saved.'],
    ['A profitable business earns $500k a year and similar businesses sell at 4x earnings. What is it worth?', 'About $2M — and unlike a startup, that number comes from cash it actually produces.'],
  ],
  venture: [
    ['A $100M fund needs a 3x return. What must the portfolio produce?', '$300M — and with most investments failing, a couple of companies have to return the whole fund alone.'],
    ['Why will a VC pass on a business that will reliably be worth $30M?', 'It cannot return their fund. Good business, wrong instrument.'],
    ['You want to keep the company and take home profit. Which capital fits?', 'Revenue, a bank loan, or revenue-based financing. Venture requires an exit.'],
    ['A VC asks "how does this become a billion-dollar company?" What are they really asking?', 'Whether the market is big enough that their bet can pay for all the others.'],
    ['What does a seed investor buy that a Series A investor does not?', 'Belief. Seed buys the team and the insight; Series A buys evidence it repeats.'],
  ],
  terms: [
    ['You raise on a SAFE with a $8M cap. The next round prices at $20M. What happens?', 'You convert at the $8M cap, so you get a much better price than the new investors.'],
    ['A 2x participating preference on $10M invested, company sells for $40M. What do investors take?', '$20M first, then their share of the remaining $20M. Founders split what is left.'],
    ['Which is worse for a founder: a lower valuation with clean terms, or a higher one with a 2x participating preference?', 'Usually the high one. Preference stacks can eat the entire founder outcome in a modest exit.'],
    ['An investor asks for a 15% option pool created pre-money. What does that actually cost you?', 'The full 15% comes out of the existing shareholders — mostly you — before the investor buys in.'],
    ['Why do board seats matter more than a point of valuation?', 'The board can fire you, block a sale, and approve financings. Price is one moment; control is every moment after.'],
    ['A term sheet is signed. Is the deal done?', 'No. It is non-binding except for exclusivity — diligence still has to clear.'],
  ],
  scale: [
    ['One salesperson closes reliably; you hire five and results collapse. What was missing?', 'A repeatable process. You scaled a person, not a motion.'],
    ['Revenue doubles and support costs triple. What does that say about scaling?', 'You are growing, not scaling. Cost is rising faster than revenue.'],
    ['At what team size does informal coordination usually break?', 'Around 30 to 50. Past that, what everybody knew has to be written down.'],
    ['You add 12 people in a quarter and output falls. Why?', 'Onboarding consumes your best people, and communication paths grow faster than headcount.'],
    ['Sales add 100 customers a month, churn takes 100. What is the growth ceiling and how do you raise it?', 'You are at it. Only lowering churn moves it — more sales just cycles faster.'],
  ],
  org: [
    ['You are the bottleneck on every decision. What is the first fix?', 'Hand over decisions, not tasks. Delegating work while keeping approval changes nothing.'],
    ['A manager has 15 direct reports. What breaks first?', 'Coaching and quality of attention. Past about seven, people get managed by exception only.'],
    ['You say quality matters but ship on the date regardless. What is your actual culture?', 'Dates over quality. Culture is what gets rewarded, not what gets said.'],
    ['The same mistake happens twice in two teams. What does that call for?', 'Process — a checklist or a norm. One mistake is bad luck; two is a system.'],
  ],
};

/* Flat card list, tagged with its principle and phase name. */
export const CURRICULUM_CARDS = PRINCIPLES.flatMap((p) => {
  const phase = PHASES.find((x) => x.id === p.phase);
  const base = p.cards.map(([front, back]) => ({ front, back, category: phase.name, principle: p.id }));
  const applied = (APPLIED[p.id] || []).map(([front, back]) => ({ front, back, category: phase.name, principle: p.id }));
  return [...base, ...applied];
});
