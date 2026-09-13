# -*- coding: utf-8 -*-
"""
HEXALIS — site content.
Everything the website says lives here. Edit this file, run `python3 build.py`,
and the HTML is regenerated. No CMS, no framework, no build tooling required.
"""

SITE = {
    "name": "HEXALIS",
    "domain": "hexalis.in",
    "url": "https://hexalis.in",
    "tagline": "Empowering Business. Enabling Possibilities.",
    "promise": "One partner. Every side of your business.",
    "email": "ContactUs@hexalis.in",
    "instagram": "https://www.instagram.com/hexalis.in",
    "threads": "https://www.threads.com/@hexalis.in",
    # WhatsApp: full international number, digits only (91 = India), as wa.me
    # expects. The message is pre-filled in the chat; the visitor just presses send.
    "whatsapp": "919690573335",
    "whatsapp_display": "+91 96905 73335",
    "whatsapp_message": "Hi HEXALIS, I found you through hexalis.in and would like to start a conversation about how you could help my business.",
    "linkedin": "",
    "description": (
        "HEXALIS is a six-pillar enterprise. Technology, strategy, brand growth, "
        "engagement, workplace and commerce — delivered by one accountable team "
        "instead of six unconnected vendors."
    ),
}

# --------------------------------------------------------------------------
# Icons — hand-drawn line marks, 48x48 grid, stroke uses currentColor.
# --------------------------------------------------------------------------
ICONS = {
    "chip": """<rect x="16" y="16" width="16" height="16" rx="2"/><rect x="21.5" y="21.5" width="5" height="5" rx="1"/>
<path d="M20 16v-5M28 16v-5M20 37v-5M28 37v-5M16 20h-5M16 28h-5M37 20h-5M37 28h-5"/>""",
    "compass": """<circle cx="24" cy="24" r="13"/><path d="M24 11.5v-3M24 39.5v-3M11.5 24h-3M39.5 24h3"/>
<path d="M24 15l2.6 6.4L33 24l-6.4 2.6L24 33l-2.6-6.4L15 24l6.4-2.6z"/>""",
    "growth": """<path d="M12 36V26M20 36V21M28 36V29"/><path d="M11 40h26"/>
<path d="M14 20l8-7 6 5 10-9"/><path d="M31 9h7v7"/>""",
    "triad": """<circle cx="24" cy="13" r="5"/><circle cx="13" cy="32" r="5"/><circle cx="35" cy="32" r="5"/>
<path d="M18.5 17.5 15 25.5M29.5 17.5 33 25.5M18.5 33.5h11"/>""",
    "building": """<path d="M13 39V15l11-6 11 6v24"/><path d="M9 39h30"/>
<path d="M19 21h4M25 21h4M19 27h4M25 27h4M19 33h10"/>""",
    "cart": """<path d="M9 12h4l4.5 17h16L37 17H15"/><circle cx="20" cy="36" r="2.5"/><circle cx="32" cy="36" r="2.5"/>
<path d="M26 6l5 3v5l-5 3-5-3V9z"/>""",
}

# --------------------------------------------------------------------------
# The six pillars — sourced directly from the HEXALIS strategy document.
# --------------------------------------------------------------------------
PILLARS = [
    {
        "num": "01",
        "slug": "technology",
        "name": "Technology",
        "kicker": "Technology, Data, AI & Talent Solutions",
        "tagline": "Connecting Intelligence with Human Potential",
        "outcome": "Potential",
        "icon": "chip",
        "purpose": "Enable businesses to transform, automate and scale through technology, data, AI and specialist talent.",
        "core": "Help organizations use technology, data, AI and specialist talent to improve efficiency, intelligence and business performance.",
        "vision": "To make intelligent technology a catalyst for human and business potential.",
        "mission": "To help organizations harness technology, data, AI and skilled talent to simplify operations, improve decisions and accelerate transformation.",
        "goals": [
            "Build strong capabilities across technology, data, AI and automation.",
            "Develop consulting, implementation and staff augmentation revenue streams.",
            "Create recurring technology engagements and long-term enterprise relationships.",
        ],
        "streams": [
            ("Technology Consulting", "Strategy, architecture, ITSM, governance, transformation"),
            ("Data & AI Solutions", "Analytics, BI, data engineering, AI and GenAI"),
            ("Automation & Implementation", "Workflow, process automation, integrations"),
            ("Talent & Staff Augmentation", "Developers, data engineers, analysts, AI specialists, PMs"),
            ("Managed Services & Support", "Ongoing technology and support services"),
        ],
        "ladder_title": "How the work compounds",
        "ladder": ["Consult", "Implement", "Augment", "Manage"],
        "ladder_note": "Clients rarely need all four on day one. They start where the pain is, and the relationship deepens as trust does — which is why augmentation and managed services become the steady heartbeat of this pillar.",
        "pull": "Technology is only useful when someone stays to run it.",
    },
    {
        "num": "02",
        "slug": "strategy",
        "name": "Strategy",
        "kicker": "Business Strategy, Consulting & Transformation",
        "tagline": "Transforming Vision into Sustainable Value",
        "outcome": "Value",
        "icon": "compass",
        "purpose": "Help businesses define the right direction, improve performance and successfully translate strategy into execution.",
        "core": "Help organizations make better strategic decisions, transform operations and build capabilities for sustainable growth.",
        "vision": "To help ambitious organizations turn bold ideas into enduring business value.",
        "mission": "To combine insight, experience and structured execution to help leaders make better decisions, transform organizations and achieve sustainable outcomes.",
        "goals": [
            "Build capabilities in corporate strategy, management consulting and transformation advisory.",
            "Become a trusted advisory partner to founders, CXOs and business leaders.",
            "Connect strategy with execution rather than limiting HEXALIS to recommendation-only consulting.",
        ],
        "streams": [
            ("Corporate Strategy", "Growth, diversification, market entry, business planning"),
            ("Management Consulting", "Operating model, organization, governance"),
            ("Business Transformation", "Transformation roadmap and execution"),
            ("Operational Excellence", "Process improvement, KPI frameworks"),
            ("PMO & Program Advisory", "PMO setup, governance, portfolio management"),
            ("Executive Advisory", "Ongoing founder and management advisory"),
            ("Learning & Capability", "Corporate workshops, training, masterclasses"),
            ("Professional Talent", "Project managers, business analysts, change and process professionals"),
        ],
        "ladder_title": "Where most consulting stops",
        "ladder": ["Diagnose", "Decide", "Execute", "Embed"],
        "ladder_note": "A recommendation is not an outcome. HEXALIS is built to stay past the deck — into the program, the operating model and the people who have to live with it.",
        "pull": "We do not hand over a slide and wish you luck.",
    },
    {
        "num": "03",
        "slug": "growth",
        "name": "Growth",
        "kicker": "Brand, Marketing & Digital Growth",
        "tagline": "Accelerating Brands towards Greater Possibilities",
        "outcome": "Growth",
        "icon": "growth",
        "purpose": "Build stronger brands, create meaningful market visibility and convert engagement into measurable growth.",
        "core": "Help organizations strengthen their brands, reach the right audiences and convert visibility into measurable business growth.",
        "vision": "To help brands realize their potential and become more relevant, visible and valuable.",
        "mission": "To combine strategy, creativity, content, digital platforms and partnerships to build brands, engage audiences and accelerate measurable growth.",
        "goals": [
            "Establish HEXALIS Growth as the first major market-facing business.",
            "Build capabilities across brand promotion, digital campaigns, creators, content and brand strategy.",
            "Develop a healthy combination of campaign revenue and recurring retainers.",
            "Build strong relationships with marketing leaders in selected high-potential industries.",
        ],
        "streams": [
            ("Brand Strategy", "Positioning, messaging, identity, brand architecture"),
            ("Campaign Management", "Product and brand campaigns"),
            ("Social Media Management", "Content, publishing, community"),
            ("Influencer Marketing", "Creator campaigns and product promotion"),
            ("Content & Creative", "Video, design, copy, corporate content"),
            ("Performance Marketing", "Paid media, acquisition campaigns"),
            ("Lead Generation", "B2B demand generation"),
            ("Digital Presence", "Website, SEO, landing pages"),
        ],
        "ladder_title": "The four offers we lead with",
        "ladder": ["Brand & Product Promotion", "Creator Campaigns", "Digital & Social", "Creative & Content"],
        "ladder_note": "Growth is the first HEXALIS revenue engine and the front door for most relationships. It is deliberately concentrated: four offers done properly beat twenty done thinly.",
        "pull": "Visibility is a means. Revenue is the point.",
    },
    {
        "num": "04",
        "slug": "engagement",
        "name": "Engagement",
        "kicker": "Events & Experiences",
        "tagline": "Inspiring Connections through Memorable Experiences",
        "outcome": "Connection",
        "icon": "triad",
        "purpose": "Create memorable experiences that strengthen connections between organizations, brands and people.",
        "core": "Create meaningful experiences that connect organizations with customers, employees, partners and stakeholders.",
        "vision": "To create experiences that bring people, brands and organizations closer together.",
        "mission": "To design and deliver purposeful experiences, events and activations that inspire participation, strengthen relationships and create lasting memories.",
        "goals": [
            "Build capabilities across corporate events, brand activations, launches and employee and customer engagement.",
            "Develop a dependable national ecosystem of venues, production houses, artists, vendors and specialists.",
            "Cross-sell engagement into existing Growth and corporate accounts.",
        ],
        "streams": [
            ("Corporate Events", "Annual meets, town halls, celebrations"),
            ("Conferences & Summits", "Corporate and industry conferences"),
            ("Product Launches", "Launch events"),
            ("Brand Activations", "Consumer and retail activations"),
            ("Employee Engagement", "Employee programs and events"),
            ("Exhibitions", "Booth design and management"),
            ("Event Production", "AV, staging, creative, content"),
            ("Sponsorship Management", "Sponsor sourcing and management"),
        ],
        "ladder_title": "Deliberately asset-light",
        "ladder": ["Client", "Concept", "Project", "Quality"],
        "ladder_note": "HEXALIS owns the client, the concept, the project and the quality bar. Specialist partners bring the trucks, the trusses and the crew. That keeps the model flexible without diluting who is accountable when the doors open.",
        "pull": "Positioned around experiences, not simply event management.",
    },
    {
        "num": "05",
        "slug": "workplace",
        "name": "Workplace",
        "kicker": "Corporate & Workplace Solutions",
        "tagline": "Strengthening Connections through Purposeful Solutions",
        "outcome": "Purpose",
        "icon": "building",
        "purpose": "Enable organizations to create better employee and workplace experiences through reliable, customized corporate products and solutions.",
        "core": "Help organizations equip, engage and support their people and workplaces through practical corporate solutions.",
        "vision": "To make everyday business interactions more meaningful through thoughtfully designed workplace solutions.",
        "mission": "To provide reliable, customized and purposeful gifting, merchandise, recognition, procurement and workplace solutions that strengthen relationships between organizations, employees and customers.",
        "goals": [
            "Build a curated ecosystem for corporate gifting, merchandise, employee kits, rewards, office supplies and procurement.",
            "Develop reliable supplier relationships with strong quality, pricing and fulfilment standards.",
            "Build recurring B2B procurement and employee-engagement programs rather than depending only on seasonal gifting.",
            "Develop customization and white-label capabilities.",
        ],
        "streams": [
            ("Corporate Gifting", "Festivals, milestones, client gifts"),
            ("Branded Merchandise", "Apparel, bags, bottles, accessories"),
            ("Employee Kits", "Joining, welcome and recognition kits"),
            ("Rewards & Recognition", "Awards and employee rewards"),
            ("Event Merchandise", "Delegate kits and event merchandise"),
            ("Office Supplies", "Regular workplace consumables"),
            ("Corporate Procurement", "Managed sourcing"),
            ("Customized Products", "Client-specific branded products"),
        ],
        "ladder_title": "Built for frequency, not seasons",
        "ladder": ["Source", "Customize", "Fulfil", "Repeat"],
        "ladder_note": "Gifting season is a spike. Onboarding kits, recognition programs and managed procurement are a rhythm. This pillar is designed for the rhythm — high transaction frequency, dependable quality, no last-minute scrambling in October.",
        "pull": "The kit on a new joiner's desk is a brand moment too.",
    },
    {
        "num": "06",
        "slug": "commerce",
        "name": "Commerce",
        "kicker": "Commerce & Digital Products",
        "tagline": "Connecting People with Meaningful Products and Services",
        "outcome": "Scale",
        "icon": "cart",
        "purpose": "Build scalable product-led businesses by identifying demand, validating opportunities and using digital channels to reach customers efficiently.",
        "core": "Build scalable product and digital businesses using modern commerce channels and validated customer demand.",
        "vision": "To create accessible, scalable businesses that connect meaningful products and solutions with the people who value them.",
        "mission": "To identify promising products, ideas and digital opportunities and transform them into scalable commerce ventures through technology, partnerships and customer insight.",
        "goals": [
            "Establish selected e-commerce and drop-shipping ventures with controlled initial investment.",
            "Explore physical products, digital products and new commerce models rather than limiting the pillar to one business model.",
            "Use data and experimentation to identify scalable opportunities before committing significant capital.",
            "Build independent revenue streams that complement the HEXALIS B2B services.",
        ],
        "streams": [
            ("Dropshipping", "Supplier-fulfilled products"),
            ("D2C E-commerce", "Own online storefronts"),
            ("Marketplace Commerce", "Marketplace sales"),
            ("B2B Commerce", "Online corporate and product sales"),
            ("Curated Products", "Category and niche collections"),
            ("Private Label", "HEXALIS-owned and partner-owned brands"),
            ("Digital Products", "Templates, toolkits, resources, courses"),
            ("Subscriptions", "Recurring products and services"),
            ("New Ventures", "New validated product concepts"),
        ],
        "ladder_title": "The validation path",
        "ladder": ["Dropship", "Test", "Validate", "Stock Winners", "Private Label", "Build Brand", "Scale"],
        "ladder_note": "Drop-shipping has one job here: market validation with limited inventory commitment. It is the first rung, not the identity. Commerce is a venture-building arm, not an online store.",
        "pull": "Spend on evidence, not on optimism.",
    },
]

# --------------------------------------------------------------------------
# Enterprise-level narrative (slide 1 of the strategy document).
# --------------------------------------------------------------------------
ENTERPRISE = {
    "vision": "To build a trusted, future-ready enterprise that brings together intelligence, strategy, creativity and execution to unlock new possibilities for businesses and people.",
    "mission": "To help organizations solve challenges, accelerate growth and create sustainable value through integrated technology, strategy, brand, engagement, workplace and commerce solutions.",
    "goals": [
        ("Build trust", "Establish HEXALIS as a credible and dependable partner for businesses."),
        ("Create sustainable growth", "Develop profitable, scalable and recurring revenue across the six pillars."),
        ("Deliver measurable value", "Focus every engagement on meaningful business outcomes."),
        ("Build an integrated ecosystem", "Connect internal capabilities with a strong network of specialists, vendors and partners."),
        ("Scale with agility", "Build lean systems, technology and processes that let HEXALIS expand without unnecessary complexity."),
        ("Create long-term relationships", "Grow from individual projects into multi-service, multi-pillar strategic relationships."),
    ],
}

# --------------------------------------------------------------------------
# "One brief, six pillars" — how an integrated engagement actually looks.
# --------------------------------------------------------------------------
SCENARIOS = [
    {
        "id": "newmarket",
        "label": "A company entering a new market",
        "summary": "A business with a signed mandate for a new market, a headcount plan and eighteen months to prove it. Normally that means six procurement cycles. Here it means one.",
        "moves": [
            ("strategy", "Market-entry plan", "Operating model, entity strategy, governance and the KPI framework the board will be judged on."),
            ("technology", "The stack that runs it", "Core platforms, data and reporting, integrations with what you already run — then engineers embedded until the local team is real."),
            ("growth", "A brand that lands locally", "Positioning adapted for the market, launch campaign, creators, performance media and a lead engine that feeds the sales hire."),
            ("engagement", "The launch itself", "Announcement event, partner summit, first town hall — produced, not improvised."),
            ("workplace", "Day one for every new hire", "Joining kits, branded merchandise, office supply and a procurement rhythm that does not need a monthly escalation."),
            ("commerce", "A direct channel", "Marketplace and D2C presence tested with limited commitment before capital follows demand."),
        ],
    },
    {
        "id": "enterprise",
        "label": "An enterprise annual cycle",
        "summary": "An established Indian enterprise with a full calendar: a transformation program, a flagship conference, a rebrand and 4,000 employees to keep engaged.",
        "moves": [
            ("strategy", "Transformation, run properly", "PMO stood up, portfolio governance, process improvement and the reporting that survives a board review."),
            ("technology", "Automation where it pays", "Workflow automation, analytics and managed support on the platforms the business actually depends on."),
            ("growth", "Rebrand to market", "Brand architecture, messaging, digital presence and the always-on social and content retainer behind it."),
            ("engagement", "The flagship moments", "Annual conference, leadership town halls, employee engagement programs and sponsor management."),
            ("workplace", "Recognition that arrives on time", "Rewards, awards, delegate kits and festival gifting on a planned calendar instead of a scramble."),
            ("commerce", "New revenue, tested", "Curated product lines and B2B commerce piloted alongside the core business."),
        ],
    },
    {
        "id": "scaleup",
        "label": "A funded scale-up",
        "summary": "Series A raised, a board expecting a plan, a team of forty and no time to hire six agencies.",
        "moves": [
            ("growth", "Demand, fast", "Performance marketing, creator campaigns and a lead engine that gives the board a number to look at."),
            ("strategy", "Structure behind the sprint", "Operating model, hiring plan, KPI framework and executive advisory as the company doubles."),
            ("technology", "Engineering capacity on tap", "Staff augmentation for developers, data engineers and analysts without an eight-week hiring cycle."),
            ("commerce", "Channel expansion", "Marketplace and D2C storefronts validated before the inventory bet."),
            ("engagement", "Moments that matter", "Product launch, investor and customer events, and the internal culture programs that keep forty people together."),
            ("workplace", "Culture you can hold", "Onboarding kits and merchandise that make a fast-growing team feel like one company."),
        ],
    },
    {
        "id": "founder",
        "label": "A founder-led business",
        "summary": "A profitable, owner-run company that has outgrown its systems and wants a partner rather than a panel of consultants.",
        "moves": [
            ("strategy", "A second opinion that stays", "Growth and diversification planning, plus an ongoing advisory relationship with the founder."),
            ("technology", "Out of spreadsheets", "Process digitization, reporting and automation sized for the business, not for a Fortune 500."),
            ("growth", "A brand worthy of the business", "Identity, digital presence and a content rhythm that stops depending on the founder's own social account."),
            ("workplace", "Client and employee gifting", "Reliable, customized, on-brand and on-time."),
            ("engagement", "Customer and partner moments", "Focused events and activations that deepen the relationships already earning the revenue."),
            ("commerce", "The next line", "Digital products and curated collections that create income outside the founder's calendar."),
        ],
    },
]

# --------------------------------------------------------------------------
# How we engage.
# --------------------------------------------------------------------------
MODES = [
    ("Advisory", "Retainer",
     "Ongoing counsel for founders, CXOs and leadership teams. Standing access, a monthly rhythm, and someone who already knows the context when the question is urgent."),
    ("Project", "Fixed scope",
     "A defined outcome with a defined end. Strategy engagements, campaigns, transformation workstreams, launches, builds. Scoped, priced and delivered against a plan."),
    ("Embedded", "Talent",
     "Our specialists inside your team, on your tools, in your stand-ups. Developers, data engineers, analysts, AI specialists, project and change professionals."),
    ("Managed", "Continuous",
     "We run it. Technology support, social and content, procurement programs, commerce operations — an operating rhythm with an SLA, not a favour."),
]

PROCESS = [
    ("Diagnose", "We start with the business, not the brief. What is actually in the way, what has already been tried, and what the number needs to be."),
    ("Design", "A plan with an owner, a sequence and a cost. Pillars are chosen because they are needed, not because we sell them."),
    ("Deliver", "One team, one plan, one point of accountability — even when four pillars are moving at once."),
    ("Sustain", "The part most partners skip. Handover, capability building, managed support, and a relationship that outlasts the engagement."),
]

# Why the integrated model matters — the argument, stated plainly.
CONTRAST = {
    "fragmented": [
        "A consulting firm writes the strategy.",
        "A systems integrator builds part of it.",
        "An agency takes it to market.",
        "An events company stages the launch.",
        "A gifting vendor ships the kits, late.",
        "Someone's nephew runs the online store.",
    ],
    "integrated": [
        "One brief, understood once.",
        "One team that shares a language and a standard.",
        "Six pillars that can be switched on as needed.",
        "One commercial relationship to negotiate and renew.",
        "One escalation path when something goes wrong.",
        "A partner who is still there after the invoice clears.",
    ],
}

FAQS = [
    ("Is HEXALIS a consultancy, an agency or a supplier?",
     "All three, structured deliberately. The six pillars are separate capabilities with their own leadership, standards and economics — but a single commercial relationship and a single point of accountability. You engage the pillars you need, and the ones you do not need stay out of your way."),
    ("Do we have to buy all six?",
     "No, and most clients do not. Nearly every relationship starts inside one pillar. The point of the model is that when the second need appears — and it always does — you are not starting a procurement cycle from zero."),
    ("How do you keep quality consistent across such different work?",
     "By owning the parts that decide quality: the client relationship, the concept, the project management and the standard. Where specialist infrastructure is needed — production crews, manufacturing, fulfilment — we work through a vetted partner ecosystem, and we remain the accountable party."),
    ("What does a first conversation look like?",
     "Thirty minutes, no deck. We want to understand the business problem, what has already been tried, and what success would look like on a specific date. If HEXALIS is not the right answer, we will say so."),
    ("Where are you based and where do you work?",
     "HEXALIS is an India-based enterprise working with organizations across the country, and with international businesses building or scaling their India presence. Delivery is a mix of on-site and distributed depending on the pillar."),
]
