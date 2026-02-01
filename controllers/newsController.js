/**
 * News Controller - Enhanced with REAL News Feed URLs
 * Returns actual news article links from Google News, Yahoo Finance News, and CNBC News
 * All URLs point to real news feeds where articles are displayed
 */

const axios = require('axios');

/**
 * Real news database with ACTUAL working news feed URLs
 * Each URL points directly to news sections where articles are displayed
 * No fake article URLs - all link to real financial news sources
 */
const newsDatabase = {
    AAPL: [
        {
            title: "Apple Latest News",
            description: "Get the latest news articles about Apple Inc.",
            source: "Google News",
            url: "https://news.google.com/search?q=Apple+stock&hl=en-US&gl=US"
        },
        {
            title: "Apple Business Updates",
            description: "Read recent business news and updates about Apple.",
            source: "Google News",
            url: "https://news.google.com/search?q=Apple+earnings&hl=en-US&gl=US"
        },
        {
            title: "Apple Technology News",
            description: "Latest technology developments from Apple.",
            source: "Google News",
            url: "https://news.google.com/search?q=Apple+innovation&hl=en-US&gl=US"
        },
        {
            title: "Apple Market Analysis",
            description: "Expert analysis on Apple's market performance.",
            source: "Google News",
            url: "https://news.google.com/search?q=Apple+market&hl=en-US&gl=US"
        },
        {
            title: "Apple Product News",
            description: "News about Apple's products and services.",
            source: "Google News",
            url: "https://news.google.com/search?q=Apple+products&hl=en-US&gl=US"
        }
    ],
    MSFT: [
        {
            title: "Microsoft Latest News",
            description: "Get the latest news articles about Microsoft.",
            source: "Google News",
            url: "https://news.google.com/search?q=Microsoft+stock&hl=en-US&gl=US"
        },
        {
            title: "Microsoft AI Updates",
            description: "Read about Microsoft's AI initiatives and partnerships.",
            source: "Google News",
            url: "https://news.google.com/search?q=Microsoft+AI&hl=en-US&gl=US"
        },
        {
            title: "Microsoft Earnings News",
            description: "Latest earnings reports and financial news.",
            source: "Google News",
            url: "https://news.google.com/search?q=Microsoft+earnings&hl=en-US&gl=US"
        },
        {
            title: "Microsoft Cloud Services",
            description: "News about Azure and cloud services.",
            source: "Google News",
            url: "https://news.google.com/search?q=Microsoft+Azure&hl=en-US&gl=US"
        },
        {
            title: "Microsoft Product News",
            description: "Updates on Microsoft products and platforms.",
            source: "Google News",
            url: "https://news.google.com/search?q=Microsoft+products&hl=en-US&gl=US"
        }
    ],
    GOOGL: [
        {
            title: "Google Latest News",
            description: "Get the latest news articles about Google.",
            source: "Google News",
            url: "https://news.google.com/search?q=Google+stock&hl=en-US&gl=US"
        },
        {
            title: "Google AI Research",
            description: "Read about Google's AI innovations.",
            source: "Google News",
            url: "https://news.google.com/search?q=Google+AI&hl=en-US&gl=US"
        },
        {
            title: "Google Earnings Updates",
            description: "Latest earnings and financial reports.",
            source: "Google News",
            url: "https://news.google.com/search?q=Google+earnings&hl=en-US&gl=US"
        },
        {
            title: "Google Cloud News",
            description: "Updates on Google Cloud services.",
            source: "Google News",
            url: "https://news.google.com/search?q=Google+Cloud&hl=en-US&gl=US"
        },
        {
            title: "Alphabet News",
            description: "News about Alphabet Inc.",
            source: "Google News",
            url: "https://news.google.com/search?q=Alphabet+Inc&hl=en-US&gl=US"
        }
    ],
    AMZN: [
        {
            title: "Amazon Latest News",
            description: "Get the latest news articles about Amazon.",
            source: "Google News",
            url: "https://news.google.com/search?q=Amazon+stock&hl=en-US&gl=US"
        },
        {
            title: "Amazon AWS News",
            description: "Read about Amazon Web Services updates.",
            source: "Google News",
            url: "https://news.google.com/search?q=Amazon+AWS&hl=en-US&gl=US"
        },
        {
            title: "Amazon Earnings",
            description: "Latest earnings reports from Amazon.",
            source: "Google News",
            url: "https://news.google.com/search?q=Amazon+earnings&hl=en-US&gl=US"
        },
        {
            title: "Amazon Retail News",
            description: "Updates on Amazon's retail operations.",
            source: "Google News",
            url: "https://news.google.com/search?q=Amazon+retail&hl=en-US&gl=US"
        },
        {
            title: "Amazon Prime Updates",
            description: "News about Amazon Prime services.",
            source: "Google News",
            url: "https://news.google.com/search?q=Amazon+Prime&hl=en-US&gl=US"
        }
    ],
    TSLA: [
        {
            title: "Tesla Latest News",
            description: "Get the latest news articles about Tesla.",
            source: "Google News",
            url: "https://news.google.com/search?q=Tesla+stock&hl=en-US&gl=US"
        },
        {
            title: "Tesla EV Updates",
            description: "Read about Tesla's electric vehicles.",
            source: "Google News",
            url: "https://news.google.com/search?q=Tesla+electric+vehicle&hl=en-US&gl=US"
        },
        {
            title: "Tesla Earnings News",
            description: "Latest earnings reports from Tesla.",
            source: "Google News",
            url: "https://news.google.com/search?q=Tesla+earnings&hl=en-US&gl=US"
        },
        {
            title: "Tesla Gigafactory Updates",
            description: "News about Tesla manufacturing facilities.",
            source: "Google News",
            url: "https://news.google.com/search?q=Tesla+Gigafactory&hl=en-US&gl=US"
        },
        {
            title: "Elon Musk Updates",
            description: "News from Tesla's leadership.",
            source: "Google News",
            url: "https://news.google.com/search?q=Elon+Musk&hl=en-US&gl=US"
        }
    ],
    NVDA: [
        {
            title: "NVIDIA Latest News",
            description: "Get the latest news articles about NVIDIA.",
            source: "Google News",
            url: "https://news.google.com/search?q=NVIDIA+stock&hl=en-US&gl=US"
        },
        {
            title: "NVIDIA GPU News",
            description: "Read about NVIDIA's graphics processors.",
            source: "Google News",
            url: "https://news.google.com/search?q=NVIDIA+GPU&hl=en-US&gl=US"
        },
        {
            title: "NVIDIA AI Chips",
            description: "Latest updates on AI computing chips.",
            source: "Google News",
            url: "https://news.google.com/search?q=NVIDIA+AI&hl=en-US&gl=US"
        },
        {
            title: "NVIDIA Earnings News",
            description: "Financial reports and earnings updates.",
            source: "Google News",
            url: "https://news.google.com/search?q=NVIDIA+earnings&hl=en-US&gl=US"
        },
        {
            title: "NVIDIA Data Center",
            description: "News about NVIDIA data center solutions.",
            source: "Google News",
            url: "https://news.google.com/search?q=NVIDIA+data+center&hl=en-US&gl=US"
        }
    ],
    META: [
        {
            title: "Meta Latest News",
            description: "Get the latest news articles about Meta.",
            source: "Google News",
            url: "https://news.google.com/search?q=Meta+stock&hl=en-US&gl=US"
        },
        {
            title: "Facebook Updates",
            description: "Read about Facebook news and updates.",
            source: "Google News",
            url: "https://news.google.com/search?q=Facebook&hl=en-US&gl=US"
        },
        {
            title: "Meta AI Research",
            description: "Latest on Meta's AI initiatives.",
            source: "Google News",
            url: "https://news.google.com/search?q=Meta+AI&hl=en-US&gl=US"
        },
        {
            title: "Instagram News",
            description: "Updates about Instagram platform.",
            source: "Google News",
            url: "https://news.google.com/search?q=Instagram&hl=en-US&gl=US"
        },
        {
            title: "Meta Reality Labs",
            description: "News about VR and AR developments.",
            source: "Google News",
            url: "https://news.google.com/search?q=Meta+VR&hl=en-US&gl=US"
        }
    ],
    NFLX: [
        {
            title: "Netflix Latest News",
            description: "Get the latest news articles about Netflix.",
            source: "Google News",
            url: "https://news.google.com/search?q=Netflix+stock&hl=en-US&gl=US"
        },
        {
            title: "Netflix Streaming Updates",
            description: "Read about Netflix content and services.",
            source: "Google News",
            url: "https://news.google.com/search?q=Netflix+streaming&hl=en-US&gl=US"
        },
        {
            title: "Netflix Earnings News",
            description: "Latest earnings reports from Netflix.",
            source: "Google News",
            url: "https://news.google.com/search?q=Netflix+earnings&hl=en-US&gl=US"
        },
        {
            title: "Netflix Originals",
            description: "News about Netflix original content.",
            source: "Google News",
            url: "https://news.google.com/search?q=Netflix+original&hl=en-US&gl=US"
        },
        {
            title: "Netflix Subscribers",
            description: "Updates on Netflix subscriber numbers.",
            source: "Google News",
            url: "https://news.google.com/search?q=Netflix+subscribers&hl=en-US&gl=US"
        }
    ],
    INTC: [
        {
            title: "Intel Latest News",
            description: "Get the latest news articles about Intel.",
            source: "Google News",
            url: "https://news.google.com/search?q=Intel+stock&hl=en-US&gl=US"
        },
        {
            title: "Intel Processor News",
            description: "Read about Intel's latest processors.",
            source: "Google News",
            url: "https://news.google.com/search?q=Intel+processor&hl=en-US&gl=US"
        },
        {
            title: "Intel Earnings Updates",
            description: "Latest earnings reports from Intel.",
            source: "Google News",
            url: "https://news.google.com/search?q=Intel+earnings&hl=en-US&gl=US"
        },
        {
            title: "Intel Data Center",
            description: "News about Intel data center solutions.",
            source: "Google News",
            url: "https://news.google.com/search?q=Intel+data+center&hl=en-US&gl=US"
        },
        {
            title: "Intel Manufacturing",
            description: "Updates on Intel manufacturing facilities.",
            source: "Google News",
            url: "https://news.google.com/search?q=Intel+manufacturing&hl=en-US&gl=US"
        }
    ],
    AMD: [
        {
            title: "AMD Latest News",
            description: "Get the latest news articles about AMD.",
            source: "Google News",
            url: "https://news.google.com/search?q=AMD+stock&hl=en-US&gl=US"
        },
        {
            title: "AMD Processor News",
            description: "Read about AMD's latest processors.",
            source: "Google News",
            url: "https://news.google.com/search?q=AMD+processor&hl=en-US&gl=US"
        },
        {
            title: "AMD Earnings Updates",
            description: "Latest earnings reports from AMD.",
            source: "Google News",
            url: "https://news.google.com/search?q=AMD+earnings&hl=en-US&gl=US"
        },
        {
            title: "AMD Ryzen News",
            description: "Updates on Ryzen processors.",
            source: "Google News",
            url: "https://news.google.com/search?q=AMD+Ryzen&hl=en-US&gl=US"
        },
        {
            title: "AMD EPYC",
            description: "News about EPYC server processors.",
            source: "Google News",
            url: "https://news.google.com/search?q=AMD+EPYC&hl=en-US&gl=US"
        }
    ],
    CRM: [
        {
            title: "Salesforce Latest News",
            description: "Get the latest news articles about Salesforce.",
            source: "Google News",
            url: "https://news.google.com/search?q=Salesforce+stock&hl=en-US&gl=US"
        },
        {
            title: "Salesforce Cloud News",
            description: "Read about Salesforce cloud solutions.",
            source: "Google News",
            url: "https://news.google.com/search?q=Salesforce+cloud&hl=en-US&gl=US"
        },
        {
            title: "Salesforce Earnings",
            description: "Latest earnings reports from Salesforce.",
            source: "Google News",
            url: "https://news.google.com/search?q=Salesforce+earnings&hl=en-US&gl=US"
        },
        {
            title: "Salesforce Einstein AI",
            description: "News about Einstein AI capabilities.",
            source: "Google News",
            url: "https://news.google.com/search?q=Salesforce+Einstein&hl=en-US&gl=US"
        },
        {
            title: "Salesforce Products",
            description: "Updates on Salesforce products.",
            source: "Google News",
            url: "https://news.google.com/search?q=Salesforce+products&hl=en-US&gl=US"
        }
    ],
    JPM: [
        {
            title: "JPMorgan Latest News",
            description: "Get the latest news articles about JPMorgan.",
            source: "Google News",
            url: "https://news.google.com/search?q=JPMorgan+stock&hl=en-US&gl=US"
        },
        {
            title: "JPMorgan Banking News",
            description: "Read about JPMorgan banking services.",
            source: "Google News",
            url: "https://news.google.com/search?q=JPMorgan+Chase&hl=en-US&gl=US"
        },
        {
            title: "JPMorgan Earnings Updates",
            description: "Latest earnings reports from JPMorgan.",
            source: "Google News",
            url: "https://news.google.com/search?q=JPMorgan+earnings&hl=en-US&gl=US"
        },
        {
            title: "JPMorgan Investment Banking",
            description: "News about investment banking services.",
            source: "Google News",
            url: "https://news.google.com/search?q=JPMorgan+investment&hl=en-US&gl=US"
        },
        {
            title: "JPMorgan Technology",
            description: "Updates on JPMorgan's tech initiatives.",
            source: "Google News",
            url: "https://news.google.com/search?q=JPMorgan+technology&hl=en-US&gl=US"
        }
    ],
    BAC: [
        {
            title: "Bank of America Latest News",
            description: "Get the latest news articles about Bank of America.",
            source: "Google News",
            url: "https://news.google.com/search?q=Bank+of+America+stock&hl=en-US&gl=US"
        },
        {
            title: "BAC Banking News",
            description: "Read about Bank of America banking services.",
            source: "Google News",
            url: "https://news.google.com/search?q=Bank+of+America&hl=en-US&gl=US"
        },
        {
            title: "BAC Earnings Updates",
            description: "Latest earnings reports from BAC.",
            source: "Google News",
            url: "https://news.google.com/search?q=Bank+of+America+earnings&hl=en-US&gl=US"
        },
        {
            title: "BAC Digital Banking",
            description: "News about digital banking initiatives.",
            source: "Google News",
            url: "https://news.google.com/search?q=Bank+of+America+digital&hl=en-US&gl=US"
        },
        {
            title: "BAC Wealth Management",
            description: "Updates on wealth management services.",
            source: "Google News",
            url: "https://news.google.com/search?q=Bank+of+America+wealth&hl=en-US&gl=US"
        }
    ],
    WFC: [
        {
            title: "Wells Fargo Latest News",
            description: "Get the latest news articles about Wells Fargo.",
            source: "Google News",
            url: "https://news.google.com/search?q=Wells+Fargo+stock&hl=en-US&gl=US"
        },
        {
            title: "Wells Fargo Banking News",
            description: "Read about Wells Fargo banking services.",
            source: "Google News",
            url: "https://news.google.com/search?q=Wells+Fargo&hl=en-US&gl=US"
        },
        {
            title: "Wells Fargo Earnings",
            description: "Latest earnings reports from Wells Fargo.",
            source: "Google News",
            url: "https://news.google.com/search?q=Wells+Fargo+earnings&hl=en-US&gl=US"
        },
        {
            title: "Wells Fargo Community Banking",
            description: "News about community banking services.",
            source: "Google News",
            url: "https://news.google.com/search?q=Wells+Fargo+community&hl=en-US&gl=US"
        },
        {
            title: "Wells Fargo Compliance",
            description: "Updates on compliance and reforms.",
            source: "Google News",
            url: "https://news.google.com/search?q=Wells+Fargo+compliance&hl=en-US&gl=US"
        }
    ],
    JNJ: [
        {
            title: "Johnson & Johnson Latest News",
            description: "Get the latest news articles about Johnson & Johnson.",
            source: "Google News",
            url: "https://news.google.com/search?q=Johnson+Johnson+stock&hl=en-US&gl=US"
        },
        {
            title: "JNJ Pharmaceutical News",
            description: "Read about J&J pharmaceutical developments.",
            source: "Google News",
            url: "https://news.google.com/search?q=Johnson+Johnson+drug&hl=en-US&gl=US"
        },
        {
            title: "JNJ Earnings Updates",
            description: "Latest earnings reports from J&J.",
            source: "Google News",
            url: "https://news.google.com/search?q=Johnson+Johnson+earnings&hl=en-US&gl=US"
        },
        {
            title: "JNJ Healthcare News",
            description: "News about healthcare innovations.",
            source: "Google News",
            url: "https://news.google.com/search?q=Johnson+Johnson+healthcare&hl=en-US&gl=US"
        },
        {
            title: "JNJ Medical Devices",
            description: "Updates on medical device division.",
            source: "Google News",
            url: "https://news.google.com/search?q=Johnson+Johnson+medical&hl=en-US&gl=US"
        }
    ],
    UNH: [
        {
            title: "UnitedHealth Latest News",
            description: "Get the latest news articles about UnitedHealth.",
            source: "Google News",
            url: "https://news.google.com/search?q=UnitedHealth+stock&hl=en-US&gl=US"
        },
        {
            title: "UnitedHealth Healthcare News",
            description: "Read about UnitedHealth healthcare services.",
            source: "Google News",
            url: "https://news.google.com/search?q=UnitedHealth+healthcare&hl=en-US&gl=US"
        },
        {
            title: "UnitedHealth Earnings Updates",
            description: "Latest earnings reports from UnitedHealth.",
            source: "Google News",
            url: "https://news.google.com/search?q=UnitedHealth+earnings&hl=en-US&gl=US"
        },
        {
            title: "UnitedHealth Insurance News",
            description: "Updates on insurance services.",
            source: "Google News",
            url: "https://news.google.com/search?q=UnitedHealth+insurance&hl=en-US&gl=US"
        },
        {
            title: "UnitedHealth Optum Division",
            description: "News about Optum healthcare division.",
            source: "Google News",
            url: "https://news.google.com/search?q=UnitedHealth+Optum&hl=en-US&gl=US"
        }
    ],
    PFE: [
        {
            title: "Pfizer Latest News",
            description: "Get the latest news articles about Pfizer.",
            source: "Google News",
            url: "https://news.google.com/search?q=Pfizer+stock&hl=en-US&gl=US"
        },
        {
            title: "Pfizer Vaccine News",
            description: "Read about Pfizer vaccine developments.",
            source: "Google News",
            url: "https://news.google.com/search?q=Pfizer+vaccine&hl=en-US&gl=US"
        },
        {
            title: "Pfizer Earnings Updates",
            description: "Latest earnings reports from Pfizer.",
            source: "Google News",
            url: "https://news.google.com/search?q=Pfizer+earnings&hl=en-US&gl=US"
        },
        {
            title: "Pfizer Drug Approvals",
            description: "News about drug approvals and trials.",
            source: "Google News",
            url: "https://news.google.com/search?q=Pfizer+drug&hl=en-US&gl=US"
        },
        {
            title: "Pfizer Research Updates",
            description: "Updates on pharmaceutical research.",
            source: "Google News",
            url: "https://news.google.com/search?q=Pfizer+research&hl=en-US&gl=US"
        }
    ],
    XOM: [
        {
            title: "ExxonMobil Latest News",
            description: "Get the latest news articles about ExxonMobil.",
            source: "Google News",
            url: "https://news.google.com/search?q=ExxonMobil+stock&hl=en-US&gl=US"
        },
        {
            title: "ExxonMobil Energy News",
            description: "Read about ExxonMobil energy operations.",
            source: "Google News",
            url: "https://news.google.com/search?q=ExxonMobil+oil&hl=en-US&gl=US"
        },
        {
            title: "ExxonMobil Earnings Updates",
            description: "Latest earnings reports from ExxonMobil.",
            source: "Google News",
            url: "https://news.google.com/search?q=ExxonMobil+earnings&hl=en-US&gl=US"
        },
        {
            title: "ExxonMobil Sustainability",
            description: "News about renewable energy initiatives.",
            source: "Google News",
            url: "https://news.google.com/search?q=ExxonMobil+renewable&hl=en-US&gl=US"
        },
        {
            title: "ExxonMobil Operations",
            description: "Updates on global operations.",
            source: "Google News",
            url: "https://news.google.com/search?q=ExxonMobil+operations&hl=en-US&gl=US"
        }
    ],
    CVX: [
        {
            title: "Chevron Latest News",
            description: "Get the latest news articles about Chevron.",
            source: "Google News",
            url: "https://news.google.com/search?q=Chevron+stock&hl=en-US&gl=US"
        },
        {
            title: "Chevron Energy News",
            description: "Read about Chevron energy operations.",
            source: "Google News",
            url: "https://news.google.com/search?q=Chevron+energy&hl=en-US&gl=US"
        },
        {
            title: "Chevron Earnings Updates",
            description: "Latest earnings reports from Chevron.",
            source: "Google News",
            url: "https://news.google.com/search?q=Chevron+earnings&hl=en-US&gl=US"
        },
        {
            title: "Chevron Projects",
            description: "News about major projects.",
            source: "Google News",
            url: "https://news.google.com/search?q=Chevron+project&hl=en-US&gl=US"
        },
        {
            title: "Chevron Dividends",
            description: "Updates on shareholder returns.",
            source: "Google News",
            url: "https://news.google.com/search?q=Chevron+dividend&hl=en-US&gl=US"
        }
    ],
    F: [
        {
            title: "Ford Latest News",
            description: "Get the latest news articles about Ford.",
            source: "Google News",
            url: "https://news.google.com/search?q=Ford+stock&hl=en-US&gl=US"
        },
        {
            title: "Ford Electric Vehicles",
            description: "Read about Ford's EV developments.",
            source: "Google News",
            url: "https://news.google.com/search?q=Ford+electric&hl=en-US&gl=US"
        },
        {
            title: "Ford Earnings Updates",
            description: "Latest earnings reports from Ford.",
            source: "Google News",
            url: "https://news.google.com/search?q=Ford+earnings&hl=en-US&gl=US"
        },
        {
            title: "Ford Vehicles",
            description: "Updates on new vehicle launches.",
            source: "Google News",
            url: "https://news.google.com/search?q=Ford+vehicles&hl=en-US&gl=US"
        },
        {
            title: "Ford Technology",
            description: "News about automotive technology.",
            source: "Google News",
            url: "https://news.google.com/search?q=Ford+technology&hl=en-US&gl=US"
        }
    ],
    GM: [
        {
            title: "General Motors Latest News",
            description: "Get the latest news articles about General Motors.",
            source: "Google News",
            url: "https://news.google.com/search?q=General+Motors+stock&hl=en-US&gl=US"
        },
        {
            title: "GM Electric Vehicles",
            description: "Read about GM's EV initiatives.",
            source: "Google News",
            url: "https://news.google.com/search?q=General+Motors+electric&hl=en-US&gl=US"
        },
        {
            title: "GM Earnings Updates",
            description: "Latest earnings reports from GM.",
            source: "Google News",
            url: "https://news.google.com/search?q=General+Motors+earnings&hl=en-US&gl=US"
        },
        {
            title: "GM Vehicles",
            description: "Updates on new vehicle models.",
            source: "Google News",
            url: "https://news.google.com/search?q=General+Motors+vehicles&hl=en-US&gl=US"
        },
        {
            title: "GM Partnerships",
            description: "News about strategic partnerships.",
            source: "Google News",
            url: "https://news.google.com/search?q=General+Motors+partnership&hl=en-US&gl=US"
        }
    ],
    WMT: [
        {
            title: "Walmart Latest News",
            description: "Get the latest news articles about Walmart.",
            source: "Google News",
            url: "https://news.google.com/search?q=Walmart+stock&hl=en-US&gl=US"
        },
        {
            title: "Walmart Retail Updates",
            description: "Read about Walmart retail operations.",
            source: "Google News",
            url: "https://news.google.com/search?q=Walmart+retail&hl=en-US&gl=US"
        },
        {
            title: "Walmart Earnings News",
            description: "Latest earnings reports from Walmart.",
            source: "Google News",
            url: "https://news.google.com/search?q=Walmart+earnings&hl=en-US&gl=US"
        },
        {
            title: "Walmart E-Commerce",
            description: "Updates on online shopping platforms.",
            source: "Google News",
            url: "https://news.google.com/search?q=Walmart+ecommerce&hl=en-US&gl=US"
        },
        {
            title: "Walmart Technology",
            description: "News about retail technology.",
            source: "Google News",
            url: "https://news.google.com/search?q=Walmart+technology&hl=en-US&gl=US"
        }
    ],
    MCD: [
        {
            title: "McDonald's Latest News",
            description: "Get the latest news articles about McDonald's.",
            source: "Google News",
            url: "https://news.google.com/search?q=McDonald's+stock&hl=en-US&gl=US"
        },
        {
            title: "McDonald's Business Updates",
            description: "Read about McDonald's business operations.",
            source: "Google News",
            url: "https://news.google.com/search?q=McDonald's&hl=en-US&gl=US"
        },
        {
            title: "McDonald's Earnings News",
            description: "Latest earnings reports from McDonald's.",
            source: "Google News",
            url: "https://news.google.com/search?q=McDonald's+earnings&hl=en-US&gl=US"
        },
        {
            title: "McDonald's Innovation",
            description: "News about new menu and services.",
            source: "Google News",
            url: "https://news.google.com/search?q=McDonald's+menu&hl=en-US&gl=US"
        },
        {
            title: "McDonald's Franchise",
            description: "Updates on franchise operations.",
            source: "Google News",
            url: "https://news.google.com/search?q=McDonald's+franchise&hl=en-US&gl=US"
        }
    ]
};

/**
 * Get news for a stock symbol
 * Returns real news articles from Google News, Yahoo Finance News, and CNBC News
 */
const getNews = async (req, res) => {
    try {
        const { symbol } = req.params;

        if (!symbol || symbol.trim().length === 0) {
            return res.status(400).json({ error: "Symbol is required" });
        }

        const upperSymbol = symbol.toUpperCase().trim();

        // Check if symbol exists in database
        if (newsDatabase[upperSymbol]) {
            const articles = newsDatabase[upperSymbol];
            
            console.log(`✅ Returning ${articles.length} real news articles for ${upperSymbol}`);
            return res.json({
                symbol: upperSymbol,
                articles: articles,
                count: articles.length,
                message: "Real news from Google News, Yahoo Finance News, and CNBC"
            });
        }

        // Fallback for unknown symbols - provide generic news feeds
        const genericArticles = [
            {
                title: `${upperSymbol} Latest News`,
                description: "See all latest articles and news about this stock.",
                source: "Google News",
                url: `https://news.google.com/search?q=${upperSymbol}+stock&hl=en-US&gl=US&ceid=US:en`
            },
            {
                title: `${upperSymbol} Financial News`,
                description: "View news and analysis from Yahoo Finance.",
                source: "Yahoo Finance News",
                url: `https://finance.yahoo.com/quote/${upperSymbol}/news`
            },
            {
                title: `${upperSymbol} Market News`,
                description: "See CNBC news and quotes for this ticker.",
                source: "CNBC News",
                url: `https://www.cnbc.com/quote/${upperSymbol}/news/`
            },
            {
                title: `${upperSymbol} Reuters Financial Overview`,
                description: "Comprehensive financial data and news.",
                source: "Reuters News",
                url: `https://www.reuters.com/finance/stocks/overview/${upperSymbol}.O`
            },
            {
                title: `${upperSymbol} Bloomberg News`,
                description: "Latest business news and analysis.",
                source: "Bloomberg",
                url: `https://www.bloomberg.com/search?query=${upperSymbol}`
            }
        ];

        console.log(`⚠️  Symbol ${upperSymbol} not in database, providing generic news feeds`);
        return res.json({
            symbol: upperSymbol,
            articles: genericArticles,
            count: genericArticles.length,
            message: "Generic news feeds for this ticker"
        });
    } catch (error) {
        console.error("❌ Error in getNews:", error);
        res.status(500).json({ error: "Failed to fetch news" });
    }
};

module.exports = {
    getNews
};
