import { Link } from 'react-router-dom'
import { FiArrowLeft, FiCpu, FiMonitor, FiZap, FiHardDrive, FiServer, FiBox, FiWind, FiGrid, FiDollarSign, FiTool, FiAlertTriangle, FiCheckCircle } from 'react-icons/fi'
import './Guide.css'

const sections = [
    {
        id: 'what-is',
        title: 'What is a PC Build?',
        icon: <FiGrid size={18} />,
        content: `A "PC build" means hand-picking every component that goes inside your computer — the processor, graphics card, memory, storage, and so on — and assembling them together yourself (or having a shop do it).

Why build instead of buying a pre-built? You get exactly the performance you need, better value for money, easy future upgrades, and you'll actually understand what's inside your machine.`
    },
    {
        id: 'components',
        title: 'The Components You Need',
        icon: <FiCpu size={18} />,
        subsections: [
            {
                title: 'Processor (CPU)',
                desc: 'The brain of your PC. It handles every calculation your computer performs.',
                tips: ['For gaming: AMD Ryzen 5 / Intel i5 and above', 'For editing & productivity: Ryzen 7 / i7 with more cores', 'Budget pick: Ryzen 5 5600 or Intel i5-12400F — both are excellent value in India']
            },
            {
                title: 'Graphics Card (GPU)',
                desc: 'Renders images, videos, and games. The single most impactful component for gaming.',
                tips: ['Budget 1080p: RTX 4060 / RX 7600', 'Mid-range 1440p: RTX 4070 / RX 7800 XT', 'Skip integrated graphics if you want to game — a dedicated GPU makes a massive difference']
            },
            {
                title: 'Motherboard',
                desc: 'The backbone that connects everything. Make sure the socket matches your CPU.',
                tips: ['AMD AM5 socket for Ryzen 7000 series, AM4 for 5000 series', 'Intel LGA 1700 for 12th/13th/14th gen', 'B-series boards (B650, B760) offer the best value — you don\'t need X-series unless overclocking heavily']
            },
            {
                title: 'RAM (Memory)',
                desc: 'Short-term memory your PC uses while running programs. More RAM = more multitasking.',
                tips: ['16 GB is the sweet spot for most users', '32 GB if you do heavy editing, streaming, or run VMs', 'DDR5 is newer but DDR4 is still great value — match what your motherboard supports']
            },
            {
                title: 'Storage (SSD / HDD)',
                desc: 'Where your operating system, games, and files live.',
                tips: ['Get an NVMe SSD (M.2) for your boot drive — it\'s 5-10x faster than a hard drive', '500 GB SSD + 1 TB HDD is a popular combo', 'Avoid SATA SSDs for new builds — NVMe is barely more expensive now']
            },
            {
                title: 'Power Supply (PSU)',
                desc: 'Delivers clean, stable power to every component. Don\'t cheap out here.',
                tips: ['80+ Bronze rated minimum, 80+ Gold is ideal', 'Use a PSU calculator (our Builder page has one!) to find your wattage', 'Stick to reputable brands: Corsair, Seasonic, Cooler Master, Antec']
            },
            {
                title: 'Case',
                desc: 'The enclosure that holds everything together. Mainly about airflow and aesthetics.',
                tips: ['ATX Mid-Tower is the most common — fits most builds', 'Check GPU clearance before buying (some cards are 30+ cm long)', 'Mesh front panels = better airflow = cooler temps']
            },
            {
                title: 'CPU Cooler',
                desc: 'Keeps your processor from overheating. Stock coolers work, but aftermarket ones are quieter and cooler.',
                tips: ['AMD Ryzen 5000 comes with a decent stock cooler — you can start with it', 'Intel stock coolers are mediocre — consider a tower cooler like Deepcool AK400', 'AIO liquid coolers are great for high-end builds but not necessary for mid-range']
            }
        ]
    },
    {
        id: 'budget',
        title: 'Budget Planning for India',
        icon: <FiDollarSign size={18} />,
        content: `Here's a rough breakdown of what to expect in Indian pricing (2024-2025):`,
        budgets: [
            { range: '₹30,000 – ₹45,000', label: 'Entry Level', desc: 'Basic 1080p gaming, office work, light editing. Ryzen 5 / i3 + integrated or entry GPU.' },
            { range: '₹50,000 – ₹80,000', label: 'Mid-Range', desc: 'Solid 1080p/1440p gaming. Ryzen 5 / i5 + RTX 4060 or RX 7600.' },
            { range: '₹80,000 – ₹1,50,000', label: 'High-End', desc: '1440p/4K gaming, streaming, content creation. Ryzen 7 / i7 + RTX 4070 or better.' },
            { range: '₹1,50,000+', label: 'Enthusiast', desc: 'No compromises. Top-tier CPU + GPU, 32 GB RAM, fast NVMe, premium case.' }
        ]
    },
    {
        id: 'compatibility',
        title: 'Compatibility — What Fits What',
        icon: <FiAlertTriangle size={18} />,
        content: `This is where beginners trip up the most. Here's what needs to match:

• CPU ↔ Motherboard: The socket must be the same (e.g., AM5 CPU needs AM5 board)
• RAM ↔ Motherboard: DDR4 board needs DDR4 RAM, DDR5 needs DDR5 — they're not interchangeable
• GPU ↔ Case: Check that your case has enough clearance for the GPU length
• PSU ↔ Everything: Make sure your power supply has enough wattage (add ~100W headroom)
• Cooler ↔ Case: Tower coolers have height limits — check your case specs
• Storage ↔ Motherboard: Confirm your board has an M.2 slot if using NVMe SSD

Our Builder page automatically checks compatibility for you, but it's good to understand why.`
    },
    {
        id: 'where-to-buy',
        title: 'Where to Buy in India',
        icon: <FiMonitor size={18} />,
        content: `PCease compares prices across these retailers so you don't have to:

• Amazon.in & Flipkart — Convenient, fast delivery, easy returns
• MD Computers — Great prices, trusted in the PC community
• Vedant Computers — Competitive pricing, good customer service
• PCStudio — Often has the lowest prices
• PrimeABGB — Wide selection of components
• The IT Depot, Compify, Clarion — Additional options worth checking

Pro tip: Prices fluctuate weekly. Use our Browse page to check which store has the best deal right now before ordering.`
    },
    {
        id: 'assembly',
        title: 'Building It — Step by Step',
        icon: <FiTool size={18} />,
        steps: [
            { num: 1, title: 'Prepare your workspace', desc: 'Clear a large table, ground yourself (touch a metal object), and keep the motherboard box handy — it makes a great anti-static work surface.' },
            { num: 2, title: 'Install CPU on motherboard', desc: 'Lift the socket lever, align the golden triangle on the CPU with the triangle on the socket, gently place it in (zero force needed), and close the lever.' },
            { num: 3, title: 'Install RAM', desc: 'Open the clips on the RAM slots, align the notch, and press firmly until both clips snap shut. If using 2 sticks, use slots 2 and 4 for dual-channel.' },
            { num: 4, title: 'Install M.2 SSD', desc: 'Remove the M.2 heatsink (if present), slide the SSD in at a 30° angle, press it flat, and screw it down.' },
            { num: 5, title: 'Install CPU cooler', desc: 'Apply a pea-sized dot of thermal paste (if not pre-applied), mount the cooler per its manual, and plug the fan header into CPU_FAN.' },
            { num: 6, title: 'Mount motherboard in case', desc: 'Install the I/O shield first, align standoffs, place the motherboard, and screw it in (don\'t overtighten).' },
            { num: 7, title: 'Install power supply', desc: 'Mount the PSU in the bottom-rear of the case (fan facing down if there\'s a vent). Route cables through the back for clean management.' },
            { num: 8, title: 'Install GPU', desc: 'Remove the necessary PCIe slot covers from the case, push the GPU into the top x16 PCIe slot until it clicks, screw it in, and connect PCIe power cables.' },
            { num: 9, title: 'Connect all cables', desc: '24-pin ATX power to motherboard, 4/8-pin CPU power (top-left of board), SATA power to drives, front panel headers (check your manual).' },
            { num: 10, title: 'First boot', desc: 'Double-check all connections, then power on. If you see the BIOS screen — congratulations, it works! Install your OS from a USB drive.' }
        ]
    },
    {
        id: 'mistakes',
        title: 'Common Beginner Mistakes',
        icon: <FiAlertTriangle size={18} />,
        mistakes: [
            'Forgetting to plug in the CPU power cable (top-left of motherboard) — the PC won\'t boot without it',
            'Not enabling XMP/DOCP in BIOS — your RAM will run slower than advertised until you do',
            'Buying a CPU and motherboard with different sockets — always double-check',
            'Spending too much on the CPU and not enough on the GPU for a gaming build',
            'Cheaping out on the PSU — a bad power supply can fry your entire system',
            'Installing RAM in slots 1 and 2 instead of 2 and 4 — you lose dual-channel performance',
            'Not installing standoffs before mounting the motherboard — risk of short circuits',
            'Panic when it doesn\'t boot — check the debug LEDs on your motherboard first before assuming something is dead'
        ]
    },
    {
        id: 'next-steps',
        title: 'You\'re Ready — What Next?',
        icon: <FiCheckCircle size={18} />,
        content: `You now know everything you need to plan and build your first PC. Here's where to go from here:`,
        ctas: true
    }
]

export default function Guide() {
    return (
        <main className="page">
            <div className="container">
                <Link to="/forum" className="guide-back">
                    <FiArrowLeft size={14} /> Back to Forum
                </Link>

                <header className="guide-header">
                    <span className="guide-header__tag">Beginner's Guide</span>
                    <h1>How to Build a PC — The Complete Guide</h1>
                    <p className="guide-header__sub">
                        Everything you need to know to plan, buy, and assemble your first PC build in India.
                        Written for complete beginners — no jargon, no assumptions.
                    </p>
                    <div className="guide-header__meta">
                        <span>By PCease Team</span>
                        <span>·</span>
                        <span>15 min read</span>
                    </div>
                </header>

                {/* Table of Contents */}
                <nav className="guide-toc">
                    <h3>In this guide</h3>
                    <ol>
                        {sections.map(s => (
                            <li key={s.id}>
                                <a href={`#${s.id}`}>{s.title}</a>
                            </li>
                        ))}
                    </ol>
                </nav>

                {/* Sections */}
                <div className="guide-content">
                    {sections.map(section => (
                        <section key={section.id} id={section.id} className="guide-section">
                            <div className="guide-section__head">
                                <span className="guide-section__icon">{section.icon}</span>
                                <h2>{section.title}</h2>
                            </div>

                            {section.content && (
                                <div className="guide-section__text">{section.content}</div>
                            )}

                            {section.subsections && (
                                <div className="guide-components">
                                    {section.subsections.map((sub, i) => (
                                        <div key={i} className="guide-comp">
                                            <h3>{sub.title}</h3>
                                            <p>{sub.desc}</p>
                                            <ul>
                                                {sub.tips.map((tip, j) => (
                                                    <li key={j}>{tip}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {section.budgets && (
                                <div className="guide-budgets">
                                    {section.budgets.map((b, i) => (
                                        <div key={i} className="guide-budget">
                                            <div className="guide-budget__header">
                                                <span className="guide-budget__range">{b.range}</span>
                                                <span className="guide-budget__label">{b.label}</span>
                                            </div>
                                            <p>{b.desc}</p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {section.steps && (
                                <div className="guide-steps">
                                    {section.steps.map(step => (
                                        <div key={step.num} className="guide-step">
                                            <span className="guide-step__num">{step.num}</span>
                                            <div>
                                                <h4>{step.title}</h4>
                                                <p>{step.desc}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {section.mistakes && (
                                <ul className="guide-mistakes">
                                    {section.mistakes.map((m, i) => (
                                        <li key={i}>{m}</li>
                                    ))}
                                </ul>
                            )}

                            {section.ctas && (
                                <div className="guide-ctas">
                                    <Link to="/builder" className="btn btn-primary btn-lg">Open PC Builder</Link>
                                    <Link to="/advisor" className="btn btn-lg">Get AI Recommendation</Link>
                                    <Link to="/browse" className="btn btn-lg">Browse Components</Link>
                                </div>
                            )}
                        </section>
                    ))}
                </div>
            </div>
        </main>
    )
}
