import { Injectable } from '@angular/core';
import { delay, Observable, of } from 'rxjs';
import { NewsArticle } from '../models/news-article.model';

type ArticleSeed = Omit<NewsArticle, 'topics'>;

export interface NewsFilter {
  searchQuery: string;
  topics: string[];
}

@Injectable({ providedIn: 'root' })
export class NewsService {
  private readonly topicsByArticleId: Record<number, string[]> = {
    1: ['Monetary Policy', 'Fed', 'Markets'],
    2: ['Technology', 'AI', 'Equities'],
    3: ['Energy', 'Commodities', 'OPEC'],
    4: ['Central Banks', 'Europe', 'Monetary Policy'],
    5: ['Crypto', 'Bitcoin', 'ETFs'],
    6: ['Real Estate', 'Housing', 'Economy'],
    7: ['Commodities', 'Gold', 'Safe Haven'],
    8: ['Retail', 'Consumer', 'Economy'],
    9: ['Emerging Markets', 'Global', 'Equities'],
    10: ['Banking', 'Earnings', 'Finance'],
    11: ['Asia', 'Equities', 'Markets'],
    12: ['ESG', 'Bonds', 'Green Finance'],
    13: ['Labor', 'Economy', 'Fed'],
    14: ['Semiconductors', 'Technology', 'AI'],
    15: ['Forex', 'Trade', 'Dollar'],
    16: ['Private Equity', 'M&A', 'Deals'],
    17: ['Asia', 'China', 'Stimulus'],
    18: ['Inflation', 'Economy', 'Fed'],
    19: ['Insurance', 'Climate', 'ESG'],
    20: ['Fintech', 'Venture Capital', 'Startups'],
    21: ['Bonds', 'Treasury', 'Rates'],
    22: ['Luxury', 'Retail', 'China'],
    23: ['Renewable Energy', 'ESG', 'Energy'],
    24: ['Personal Finance', 'Credit', 'Banking'],
    25: ['IPOs', 'Markets', 'Deals'],
    26: ['Mortgages', 'Real Estate', 'Rates'],
    27: ['Automotive', 'EV', 'Manufacturing'],
    28: ['Small Cap', 'Equities', 'Markets'],
    29: ['Gold', 'Central Banks', 'Commodities'],
    30: ['Consumer', 'Economy', 'Sentiment'],
    31: ['Cybersecurity', 'Banking', 'Technology'],
    32: ['Dividends', 'Investing', 'Equities'],
    33: ['Logistics', 'Trade', 'Supply Chain'],
    34: ['REITs', 'Real Estate', 'Rates'],
    35: ['Emerging Markets', 'India', 'GDP'],
    36: ['Crypto', 'Regulation', 'Stablecoins'],
  };

  private readonly articles: ArticleSeed[] = [
    {
      id: 1,
      title: 'Federal Reserve Signals Potential Rate Cut in Q3',
      summary:
        'The Federal Reserve hinted at a possible interest rate reduction later this year as inflation continues to moderate toward the 2% target. Chair Powell noted that labor market conditions have cooled but remain resilient, giving policymakers room to adjust monetary policy if economic data supports a shift. Markets rallied on the news, with the S&P 500 gaining 1.2% and bond yields falling across the curve.',
      imageUrl: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=600&h=400&fit=crop',
      sourceUrl: 'https://www.reuters.com/markets/',
      sourceName: 'Reuters',
      publishedAt: '2026-07-06T08:00:00Z',
    },
    {
      id: 2,
      title: 'Tech Giants Lead Market Rally Amid AI Optimism',
      summary:
        'Major technology stocks surged as investors doubled down on artificial intelligence growth prospects. Nvidia, Microsoft, and Alphabet all posted gains exceeding 3%, driving the Nasdaq to a new record high. Analysts cite expanding enterprise AI adoption and strong cloud revenue as key catalysts for the sector-wide momentum heading into earnings season.',
      imageUrl: 'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=600&h=400&fit=crop',
      sourceUrl: 'https://www.bloomberg.com/markets',
      sourceName: 'Bloomberg',
      publishedAt: '2026-07-06T07:30:00Z',
    },
    {
      id: 3,
      title: 'Oil Prices Dip as OPEC+ Considers Production Increase',
      summary:
        'Crude oil futures fell 2.1% after reports that OPEC+ members are discussing a modest output increase for the coming quarter. Brent crude settled at $78.40 per barrel, while WTI dropped to $74.15. Energy analysts warn that geopolitical tensions in the Middle East could still disrupt supply chains and create price volatility in the near term.',
      imageUrl: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=600&h=400&fit=crop',
      sourceUrl: 'https://www.cnbc.com/energy/',
      sourceName: 'CNBC',
      publishedAt: '2026-07-06T06:45:00Z',
    },
    {
      id: 4,
      title: 'European Central Bank Holds Rates Steady',
      summary:
        'The ECB kept its benchmark deposit rate unchanged at 3.25%, citing persistent inflation in services and wage growth across the eurozone. President Lagarde emphasized a data-dependent approach, noting that future decisions will hinge on incoming economic indicators. The euro strengthened slightly against the dollar following the announcement.',
      imageUrl: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=600&h=400&fit=crop',
      sourceUrl: 'https://www.ft.com/markets',
      sourceName: 'Financial Times',
      publishedAt: '2026-07-06T05:20:00Z',
    },
    {
      id: 5,
      title: 'Bitcoin Surges Past $72,000 on ETF Inflows',
      summary:
        'Bitcoin climbed above $72,000 as spot ETF inflows reached a three-month high, signaling renewed institutional interest in digital assets. Ethereum also gained 4.5%, buoyed by network upgrade anticipation. Crypto market analysts point to macro tailwinds and declining regulatory uncertainty as drivers of the current rally.',
      imageUrl: 'https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=600&h=400&fit=crop',
      sourceUrl: 'https://www.coindesk.com/markets/',
      sourceName: 'CoinDesk',
      publishedAt: '2026-07-05T22:10:00Z',
    },
    {
      id: 6,
      title: 'Housing Market Shows Signs of Stabilization',
      summary:
        'New home sales rose 3.8% in June, suggesting the housing market may be finding a floor after two years of elevated mortgage rates. Median home prices edged up 1.2% year-over-year, while inventory levels improved in several major metropolitan areas. Economists remain cautious, noting affordability constraints continue to limit buyer demand.',
      imageUrl: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=600&h=400&fit=crop',
      sourceUrl: 'https://www.wsj.com/economy/housing',
      sourceName: 'Wall Street Journal',
      publishedAt: '2026-07-05T18:00:00Z',
    },
    {
      id: 7,
      title: 'Gold Hits Record High on Safe-Haven Demand',
      summary:
        'Gold prices reached an all-time high of $2,450 per ounce as investors sought refuge amid geopolitical uncertainty and softer dollar conditions. Central bank purchases, particularly from emerging markets, have provided sustained support for bullion. Silver and platinum also advanced, tracking gold\'s upward trajectory.',
      imageUrl: 'https://images.unsplash.com/photo-1610375461244-0c2a2d2a8b4a?w=600&h=400&fit=crop',
      sourceUrl: 'https://www.kitco.com/news/',
      sourceName: 'Kitco',
      publishedAt: '2026-07-05T14:30:00Z',
    },
    {
      id: 8,
      title: 'Retail Sales Beat Expectations in June',
      summary:
        'U.S. retail sales grew 0.6% in June, surpassing economist forecasts of 0.3%. Strong consumer spending on electronics, apparel, and dining out underscored household resilience despite higher borrowing costs. The report bolstered expectations that the economy can achieve a soft landing without entering recession.',
      imageUrl: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600&h=400&fit=crop',
      sourceUrl: 'https://www.marketwatch.com/economy',
      sourceName: 'MarketWatch',
      publishedAt: '2026-07-05T12:00:00Z',
    },
    {
      id: 9,
      title: 'Emerging Markets Attract Record Portfolio Flows',
      summary:
        'Emerging market equities and bonds saw net inflows of $18 billion in the past month, the highest level since 2021. Investors are rotating into markets like India, Brazil, and Indonesia, drawn by faster GDP growth and attractive valuations. Currency stability in several regions has further reduced perceived risk for foreign investors.',
      imageUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&h=400&fit=crop',
      sourceUrl: 'https://www.reuters.com/markets/emerging/',
      sourceName: 'Reuters',
      publishedAt: '2026-07-05T09:15:00Z',
    },
    {
      id: 10,
      title: 'Corporate Earnings Season Kicks Off with Strong Banks',
      summary:
        'Major U.S. banks reported better-than-expected Q2 earnings, driven by robust trading revenue and improved net interest margins. JPMorgan, Goldman Sachs, and Wells Fargo all beat analyst estimates, setting an optimistic tone for the broader earnings season. Financial sector ETFs rose 2.3% on the results.',
      imageUrl: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&h=400&fit=crop',
      sourceUrl: 'https://www.bloomberg.com/markets/earnings',
      sourceName: 'Bloomberg',
      publishedAt: '2026-07-04T20:00:00Z',
    },
    {
      id: 11,
      title: 'Japan\'s Nikkei Reaches 35-Year High',
      summary:
        'Japan\'s Nikkei 225 index closed at its highest level since 1989, fueled by yen weakness and strong export earnings from automakers and electronics firms. The Bank of Japan\'s gradual policy normalization has not dampened equity enthusiasm, as foreign investors continue to increase their allocations to Japanese stocks.',
      imageUrl: 'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?w=600&h=400&fit=crop',
      sourceUrl: 'https://www.cnbc.com/world-markets/',
      sourceName: 'CNBC',
      publishedAt: '2026-07-04T16:45:00Z',
    },
    {
      id: 12,
      title: 'Green Bonds See Surge in Issuance',
      summary:
        'Global green bond issuance topped $120 billion in the first half of 2026, a 28% increase from the prior year. Governments and corporations are accelerating sustainable finance initiatives to meet climate commitments. Investors report strong demand for ESG-aligned fixed income products, particularly in Europe and Asia-Pacific.',
      imageUrl: 'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=600&h=400&fit=crop',
      sourceUrl: 'https://www.ft.com/climate-capital',
      sourceName: 'Financial Times',
      publishedAt: '2026-07-04T13:00:00Z',
    },
    {
      id: 13,
      title: 'U.S. Jobless Claims Fall to Eight-Month Low',
      summary:
        'Initial jobless claims dropped to 210,000 last week, the lowest reading since November, reinforcing the view of a tight labor market. Continuing claims also declined, suggesting fewer long-term unemployed workers. The data supports the Fed\'s cautious stance on rate cuts while easing recession fears among economists.',
      imageUrl: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=600&h=400&fit=crop',
      sourceUrl: 'https://www.marketwatch.com/economy',
      sourceName: 'MarketWatch',
      publishedAt: '2026-07-04T10:30:00Z',
    },
    {
      id: 14,
      title: 'Semiconductor Stocks Rally on Chip Demand Forecast',
      summary:
        'Semiconductor shares jumped after industry analysts raised global chip demand forecasts for 2026, citing AI server buildouts and automotive electrification. Taiwan Semiconductor, ASML, and AMD led gains in the sector. Supply chain constraints appear to be easing, allowing manufacturers to ramp production ahead of schedule.',
      imageUrl: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=600&h=400&fit=crop',
      sourceUrl: 'https://www.reuters.com/technology/',
      sourceName: 'Reuters',
      publishedAt: '2026-07-03T22:00:00Z',
    },
    {
      id: 15,
      title: 'Dollar Weakens as Trade Deficit Narrows',
      summary:
        'The U.S. dollar index fell 0.8% after the trade deficit narrowed more than expected in May, driven by increased exports of manufactured goods and agricultural products. Currency strategists suggest the greenback may face further pressure if the Fed begins cutting rates before other major central banks.',
      imageUrl: 'https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=600&h=400&fit=crop',
      sourceUrl: 'https://www.wsj.com/economy/trade',
      sourceName: 'Wall Street Journal',
      publishedAt: '2026-07-03T18:15:00Z',
    },
    {
      id: 16,
      title: 'Private Equity Deal Activity Rebounds',
      summary:
        'Global private equity deal volume rose 15% in Q2 2026, marking the strongest quarter in two years. Buyout firms are deploying record dry powder into healthcare, technology, and infrastructure assets. Lower financing costs and improved exit environments are encouraging sponsors to pursue larger transactions.',
      imageUrl: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=600&h=400&fit=crop',
      sourceUrl: 'https://www.bloomberg.com/deals',
      sourceName: 'Bloomberg',
      publishedAt: '2026-07-03T14:00:00Z',
    },
    {
      id: 17,
      title: 'China Stimulus Measures Boost Asian Markets',
      summary:
        'Asian equity markets rallied after China announced a new round of fiscal stimulus targeting infrastructure and consumer subsidies. The Hang Seng Index gained 2.4%, while mainland Chinese stocks also advanced. Investors hope the measures will offset weakness in the property sector and support GDP growth targets.',
      imageUrl: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=600&h=400&fit=crop',
      sourceUrl: 'https://www.cnbc.com/asia-markets/',
      sourceName: 'CNBC',
      publishedAt: '2026-07-03T10:45:00Z',
    },
    {
      id: 18,
      title: 'Inflation Expectations Anchor at 2.5%',
      summary:
        'The University of Michigan consumer sentiment survey showed five-year inflation expectations holding steady at 2.5%, a reassuring sign for policymakers. One-year expectations ticked down to 3.0% from 3.1%. Stable inflation outlooks reduce pressure on the Fed to maintain restrictive monetary policy.',
      imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&h=400&fit=crop',
      sourceUrl: 'https://www.marketwatch.com/economy',
      sourceName: 'MarketWatch',
      publishedAt: '2026-07-02T20:30:00Z',
    },
    {
      id: 19,
      title: 'Insurance Sector Faces Climate Risk Reckoning',
      summary:
        'Major insurers are raising premiums and pulling coverage from high-risk regions as climate-related losses mount. Reinsurance rates have climbed 20% year-over-year, passing costs to policyholders. Regulators are pushing for greater transparency in climate risk disclosures across the financial services industry.',
      imageUrl: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=600&h=400&fit=crop',
      sourceUrl: 'https://www.ft.com/insurance',
      sourceName: 'Financial Times',
      publishedAt: '2026-07-02T16:00:00Z',
    },
    {
      id: 20,
      title: 'Venture Capital Funding Rebounds in Fintech',
      summary:
        'Fintech startups raised $8.2 billion in Q2 2026, a 22% increase from the prior quarter, led by payments and embedded finance platforms. Investors are selectively backing companies with clear paths to profitability. The resurgence signals renewed confidence in financial technology after a two-year funding drought.',
      imageUrl: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=600&h=400&fit=crop',
      sourceUrl: 'https://www.reuters.com/fintech/',
      sourceName: 'Reuters',
      publishedAt: '2026-07-02T12:30:00Z',
    },
    {
      id: 21,
      title: 'Treasury Yields Fall on Soft PPI Data',
      summary:
        'U.S. Treasury yields declined across maturities after producer price index data came in below expectations, suggesting pipeline inflation pressures are easing. The 10-year yield dropped 8 basis points to 4.12%. Bond traders are pricing in two rate cuts by year-end, up from one cut expected last month.',
      imageUrl: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=600&h=400&fit=crop',
      sourceUrl: 'https://www.bloomberg.com/markets/rates-bonds',
      sourceName: 'Bloomberg',
      publishedAt: '2026-07-02T08:00:00Z',
    },
    {
      id: 22,
      title: 'Luxury Goods Sector Faces China Slowdown',
      summary:
        'Shares of major luxury brands fell after reporting weaker-than-expected sales in China, a key growth market. LVMH, Kering, and Hermès all saw declines as Chinese consumers pulled back on high-end purchases amid economic uncertainty. Analysts are revising full-year revenue forecasts downward for the sector.',
      imageUrl: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=600&h=400&fit=crop',
      sourceUrl: 'https://www.wsj.com/business/retail',
      sourceName: 'Wall Street Journal',
      publishedAt: '2026-07-01T19:00:00Z',
    },
    {
      id: 23,
      title: 'Renewable Energy Stocks Outperform Fossil Fuels',
      summary:
        'Clean energy equities have outperformed traditional energy stocks by 12 percentage points year-to-date, driven by policy support and falling production costs. Solar and wind project pipelines are expanding globally, while oil and gas majors face mounting pressure to accelerate their energy transition strategies.',
      imageUrl: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=600&h=400&fit=crop',
      sourceUrl: 'https://www.cnbc.com/energy/',
      sourceName: 'CNBC',
      publishedAt: '2026-07-01T15:30:00Z',
    },
    {
      id: 24,
      title: 'Credit Card Delinquencies Rise Among Young Borrowers',
      summary:
        'Credit card delinquency rates among borrowers aged 18-29 climbed to 4.8%, the highest level since 2011, according to New York Fed data. Rising living costs and student loan payments are straining household budgets. Banks are tightening lending standards in response to the uptick in missed payments.',
      imageUrl: 'https://images.unsplash.com/photo-1563013544-824ae1b704d3?w=600&h=400&fit=crop',
      sourceUrl: 'https://www.marketwatch.com/personal-finance',
      sourceName: 'MarketWatch',
      publishedAt: '2026-07-01T11:00:00Z',
    },
    {
      id: 25,
      title: 'Global IPO Market Shows Signs of Recovery',
      summary:
        'Initial public offering activity picked up in Q2 2026, with 142 companies going public worldwide and raising a combined $38 billion. Technology and healthcare firms dominated the pipeline. Improved market conditions and pent-up demand from private companies are fueling expectations for a stronger second half.',
      imageUrl: 'https://images.unsplash.com/photo-1618044597818-9f174a8f8c8a?w=600&h=400&fit=crop',
      sourceUrl: 'https://www.reuters.com/markets/deals/ipos',
      sourceName: 'Reuters',
      publishedAt: '2026-06-30T22:00:00Z',
    },
    {
      id: 26,
      title: 'Mortgage Rates Drop Below 6.5% for First Time in 2026',
      summary:
        'The average 30-year fixed mortgage rate fell to 6.45%, the lowest level since December 2025, according to Freddie Mac. The decline reflects lower Treasury yields and increased competition among lenders. Homebuyer applications rose 5% week-over-week, suggesting pent-up demand may finally be translating into activity.',
      imageUrl: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=600&h=400&fit=crop',
      sourceUrl: 'https://www.wsj.com/personal-finance/mortgages',
      sourceName: 'Wall Street Journal',
      publishedAt: '2026-06-30T18:00:00Z',
    },
    {
      id: 27,
      title: 'Automakers Invest Billions in EV Battery Plants',
      summary:
        'Ford, GM, and Stellantis announced a combined $15 billion investment in domestic EV battery manufacturing facilities. The move aligns with government incentives and aims to reduce dependence on foreign supply chains. Industry experts expect battery costs to fall 20% by 2028 as production scales up.',
      imageUrl: 'https://images.unsplash.com/photo-1593941707889-a674ba174523?w=600&h=400&fit=crop',
      sourceUrl: 'https://www.bloomberg.com/industries/autos',
      sourceName: 'Bloomberg',
      publishedAt: '2026-06-30T14:30:00Z',
    },
    {
      id: 28,
      title: 'Small-Cap Stocks Lag as Investors Favor Quality',
      summary:
        'The Russell 2000 index has underperformed the S&P 500 by 8 percentage points this year as investors prioritize large-cap quality names. Higher borrowing costs disproportionately affect smaller companies with weaker balance sheets. Some fund managers see opportunity in selective small-cap value stocks trading at deep discounts.',
      imageUrl: 'https://images.unsplash.com/photo-1590283603385-17ffb3a7f29f?w=600&h=400&fit=crop',
      sourceUrl: 'https://www.ft.com/markets/equities',
      sourceName: 'Financial Times',
      publishedAt: '2026-06-30T10:00:00Z',
    },
    {
      id: 29,
      title: 'Central Banks Increase Gold Reserves',
      summary:
        'Global central banks purchased 280 tonnes of gold in Q2 2026, continuing a multi-year trend of diversifying away from dollar-denominated assets. China, Poland, and Turkey were the largest buyers. The trend reflects geopolitical fragmentation and concerns about the long-term role of the U.S. dollar as the global reserve currency.',
      imageUrl: 'https://images.unsplash.com/photo-1610375461244-0c2a2d2a8b4a?w=600&h=400&fit=crop',
      sourceUrl: 'https://www.kitco.com/news/',
      sourceName: 'Kitco',
      publishedAt: '2026-06-29T20:00:00Z',
    },
    {
      id: 30,
      title: 'Consumer Confidence Index Rises for Third Month',
      summary:
        'The Conference Board\'s consumer confidence index climbed to 108.5 in June, the highest reading since early 2024. Improved job security perceptions and easing inflation concerns drove the increase. Retailers are optimistic that sustained confidence will support back-to-school and holiday spending seasons.',
      imageUrl: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600&h=400&fit=crop',
      sourceUrl: 'https://www.marketwatch.com/economy',
      sourceName: 'MarketWatch',
      publishedAt: '2026-06-29T16:00:00Z',
    },
    {
      id: 31,
      title: 'Cybersecurity Spending Surges in Financial Sector',
      summary:
        'Banks and financial institutions increased cybersecurity budgets by 18% this year, responding to a wave of sophisticated ransomware attacks. Regulators are mandating stricter incident reporting and resilience testing. Cybersecurity firms with financial services expertise are seeing strong demand for their products and consulting services.',
      imageUrl: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=600&h=400&fit=crop',
      sourceUrl: 'https://www.reuters.com/technology/cybersecurity',
      sourceName: 'Reuters',
      publishedAt: '2026-06-29T12:00:00Z',
    },
    {
      id: 32,
      title: 'Dividend Aristocrats Outperform in Volatile Market',
      summary:
        'Companies with 25 or more years of consecutive dividend increases have outperformed the broader market by 4% this year. Income-focused investors are gravitating toward stable, cash-generative businesses amid economic uncertainty. Dividend growth ETFs have seen net inflows of $6 billion year-to-date.',
      imageUrl: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&h=400&fit=crop',
      sourceUrl: 'https://www.cnbc.com/investing/',
      sourceName: 'CNBC',
      publishedAt: '2026-06-28T18:30:00Z',
    },
    {
      id: 33,
      title: 'Shipping Costs Normalize After Red Sea Disruptions',
      summary:
        'Container shipping rates have returned to pre-crisis levels as Red Sea transit routes stabilize and new vessel capacity enters the market. Freight costs for Asia-Europe routes fell 40% from their January peak. Lower shipping expenses are expected to ease goods inflation and improve margins for importers and retailers.',
      imageUrl: 'https://images.unsplash.com/photo-1494412574642-677141578d95?w=600&h=400&fit=crop',
      sourceUrl: 'https://www.wsj.com/business/logistics',
      sourceName: 'Wall Street Journal',
      publishedAt: '2026-06-28T14:00:00Z',
    },
    {
      id: 34,
      title: 'Real Estate Investment Trusts Gain on Rate Cut Bets',
      summary:
        'REITs rallied 3.5% this week as falling bond yields improved the relative attractiveness of dividend-paying real estate stocks. Data center and industrial REITs led gains, while office REITs continued to lag due to persistent remote work trends. Analysts recommend selective exposure to sectors with strong occupancy fundamentals.',
      imageUrl: 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&h=400&fit=crop',
      sourceUrl: 'https://www.bloomberg.com/markets/reits',
      sourceName: 'Bloomberg',
      publishedAt: '2026-06-28T10:00:00Z',
    },
    {
      id: 35,
      title: 'India\'s Economy Grows 7.2% in Q1 2026',
      summary:
        'India reported GDP growth of 7.2% in the first quarter, outpacing China and most developed economies. Strong domestic consumption, infrastructure spending, and a booming services sector drove the expansion. Foreign direct investment hit a record $22 billion, reflecting growing global confidence in India\'s economic trajectory.',
      imageUrl: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=600&h=400&fit=crop',
      sourceUrl: 'https://www.ft.com/world/asia-pacific/india',
      sourceName: 'Financial Times',
      publishedAt: '2026-06-27T20:00:00Z',
    },
    {
      id: 36,
      title: 'Stablecoin Regulation Framework Takes Shape',
      summary:
        'U.S. lawmakers are nearing bipartisan agreement on a regulatory framework for stablecoins, potentially unlocking institutional adoption of digital dollar instruments. The proposed legislation would require full reserve backing and regular audits. Crypto markets reacted positively, with stablecoin-related tokens gaining 6% on the news.',
      imageUrl: 'https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=600&h=400&fit=crop',
      sourceUrl: 'https://www.coindesk.com/policy/',
      sourceName: 'CoinDesk',
      publishedAt: '2026-06-27T16:00:00Z',
    },
  ];

  getArticles(filter: NewsFilter, page: number, pageSize: number): Observable<NewsArticle[]> {
    const filtered = this.getFilteredArticles(filter);
    const start = page * pageSize;
    const slice = filtered.slice(start, start + pageSize);
    return of(slice).pipe(delay(600));
  }

  getFilteredCount(filter: NewsFilter): number {
    return this.getFilteredArticles(filter).length;
  }

  getAllTopics(): string[] {
    const topics = new Set<string>();
    for (const articleTopics of Object.values(this.topicsByArticleId)) {
      for (const topic of articleTopics) {
        topics.add(topic);
      }
    }
    return [...topics].sort((a, b) => a.localeCompare(b));
  }

  private getFilteredArticles(filter: NewsFilter): NewsArticle[] {
    const query = filter.searchQuery.trim().toLowerCase();
    const selectedTopics = filter.topics;

    return this.articles
      .map((article) => this.enrichArticle(article))
      .filter((article) => {
        const matchesSearch =
          query.length === 0 || article.title.toLowerCase().includes(query);
        const matchesTopics =
          selectedTopics.length === 0 ||
          selectedTopics.some((topic) => article.topics.includes(topic));
        return matchesSearch && matchesTopics;
      });
  }

  private enrichArticle(article: ArticleSeed): NewsArticle {
    return {
      ...article,
      topics: this.topicsByArticleId[article.id] ?? [],
    };
  }
}
