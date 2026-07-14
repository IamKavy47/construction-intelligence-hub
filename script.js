// --- BACKEND API SYNC ---
const API_URL = 'http://127.0.0.1:8000';

async function syncStateWithBackend() {
    try {
        const response = await fetch(`${API_URL}/api/get-state`);
        const data = await response.json();
        
        State.project = data.project;
        
        State.metrics = {
            health: data.health,
            cpi: data.cpi,
            spi: data.spi,
            safety: data.safetyScore,
            budgetUsed: data.budgetUsed,
            alerts: data.alerts
        };
        
        State.risks = data.risks;
        State.uploadedDocuments = data.uploadedDocuments;
        State.materials = data.materials;
        State.equipment = data.equipment;
        State.workforce = data.workforce;
        State.safety = data.safety;
        State.chatHistory = data.chatHistory;
        State.weather_report = data.weather_report;
    } catch (e) {
        console.error("Backend offline, running in offline sandbox mode.", e);
    }
}

// --- DATA & CONFIGURATION ---
const MODULES = [
    { id: 'dashboard', name: 'Dashboard', icon: 'layout-dashboard' },
    { id: 'timeline', name: 'Timeline Intelligence', icon: 'git-commit' },
    { id: 'material', name: 'Material Intelligence', icon: 'box' },
    { id: 'equipment', name: 'Equipment Intelligence', icon: 'truck' },
    { id: 'workforce', name: 'Workforce Intelligence', icon: 'users' },
    { id: 'weather', name: 'Weather Intelligence', icon: 'cloud-lightning' },
    { id: 'risk', name: 'Risk Intelligence', icon: 'shield-alert' },
    { id: 'safety', name: 'Safety Intelligence', icon: 'hard-hat' },
    { id: 'copilot', name: 'Construction Copilot', icon: 'bot' },
];

const WIZARD_STEPS = [
    {
        id: 'basic', title: 'Basic Information', fields: [
            { id: 'projectName', label: 'Project Name', type: 'text', placeholder: 'e.g. Apex Tower' },
            { id: 'client', label: 'Client', type: 'text', placeholder: 'Client Name' },
            { id: 'location', label: 'Location', type: 'text', placeholder: 'City, Country' },
            { id: 'projectType', label: 'Project Type', type: 'select', options: ['Residential', 'Commercial', 'Industrial', 'Infrastructure'] }
        ]
    },
    {
        id: 'building', title: 'Building Information', fields: [
            { id: 'floors', label: 'Total Floors', type: 'number', placeholder: '0' },
            { id: 'builtArea', label: 'Built Area (sqm)', type: 'number', placeholder: '0' },
            { id: 'structuralSystem', label: 'Structural System', type: 'select', options: ['RC Frame', 'Steel Frame', 'Composite', 'Precast'] }
        ]
    },
    {
        id: 'schedule', title: 'Schedule Baseline', fields: [
            { id: 'startDate', label: 'Start Date', type: 'date' },
            { id: 'completionDate', label: 'Target Completion', type: 'date' },
            { id: 'shiftCount', label: 'Shift Count', type: 'select', options: ['1 Shift', '2 Shifts', '24/7 Operations'] }
        ]
    },
    {
        id: 'intelligence', title: 'Intelligence Settings', fields: [
            { id: 'aiRisk', label: 'Predictive Risk Intelligence', type: 'toggle', checked: true, desc: 'AI continuous risk forecasting' },
            { id: 'aiWeather', label: 'Weather Impact Matrix', type: 'toggle', checked: true, desc: 'Auto-adjust schedule based on weather' },
            { id: 'aiDocs', label: 'Document Conflict Detection', type: 'toggle', checked: true, desc: 'Auto-scan drawings for clashes' }
        ]
    }
];

// --- STATE MANAGEMENT ---
const State = {
    project: null,
    activeModule: 'dashboard',
    charts: [],
    wizardCurrentStep: 0,
    chatHistory: [],
    pendingUploads: [],

    // Mock dynamic data for cross-module interactions
    metrics: {
        health: 92, cpi: 1.04, spi: 0.98, safety: 98,
        budgetUsed: '42%',
        alerts: [
            { type: 'warning', text: 'Steel procurement lead time increased by 14 days.' },
            { type: 'success', text: 'Substructure phase completed 2 days early.' }
        ]
    },
    risks: [
        { id: 'R01', desc: 'Delay in facade panel delivery', prob: 'High', impact: 'High', status: 'Active' },
        { id: 'R02', desc: 'Skilled labor shortage (Welders)', prob: 'Medium', impact: 'Medium', status: 'Monitored' }
    ],
    uploadedDocuments: [],
    materials: [
        { name: 'Grade 60 Rebar', sku: 'MT-RB-60', supplier: 'Atlas Steel Co.', stock: '120 Ton', required: '150 Ton', status: 'Shortage Risk' },
        { name: 'C40/50 Concrete', sku: 'MT-CC-40', supplier: 'Apex ReadyMix', stock: 'On-Demand', required: '850 m³', status: 'On Track' },
        { name: 'Curtain Wall Panel A', sku: 'MT-FA-01', supplier: 'GlassTech Ind.', stock: '0 Units', required: '400 Units', status: 'Delayed' },
        { name: 'Type X Gypsum Board', sku: 'MT-GY-X', supplier: 'BuildMat Direct', stock: '2400 Sht', required: '2000 Sht', status: 'Healthy' }
    ],
    equipment: [
        { id: 'CRN-01', type: 'Tower Crane', model: 'Liebherr 280 EC-H', status: 'Active', operator: 'M. Chen', fuel: 'Electric', utilization: 85 },
        { id: 'EXC-03', type: 'Excavator', model: 'Cat 320', status: 'Maintenance', operator: 'Unassigned', fuel: '42%', utilization: 0 },
        { id: 'PMP-02', type: 'Concrete Pump', model: 'Putzmeister 36m', status: 'Idle', operator: 'J. Smith', fuel: '78%', utilization: 30 },
        { id: 'LDR-01', type: 'Wheel Loader', model: 'Volvo L120H', status: 'Active', operator: 'D. Ray', fuel: '55%', utilization: 92 }
    ],
    workforce: [
        { trade: 'Formwork Carpenters', contractor: 'StrucBuild LLC', headcount: 45, plan: 40, variance: '+5', productivity: '94%' },
        { trade: 'Steel Fixers', contractor: 'Atlas Rebar', headcount: 28, plan: 35, variance: '-7', productivity: '88%' },
        { trade: 'MEP Technicians', contractor: 'Wired Solutions', headcount: 12, plan: 12, variance: '0', productivity: '102%' },
        { trade: 'General Labor', contractor: 'Core Staffing', headcount: 60, plan: 60, variance: '0', productivity: '90%' }
    ],
    safety: [
        { id: 'INC-089', date: 'Today', type: 'Near Miss', location: 'Zone B, Level 2', desc: 'Dropped hand tool from scaffold', severity: 'Low' },
        { id: 'AUD-045', date: 'Yesterday', type: 'Audit', location: 'Site Wide', desc: 'Weekly PPE & Fall Protection', severity: 'Info' },
        { id: 'INC-088', date: '3 days ago', type: 'Unsafe Act', location: 'Gate 2', desc: 'Operating forklift without seatbelt', severity: 'Medium' }
    ]
};

// --- CORE APPLICATION LOGIC ---
const App = {
    async init() {
        this.renderSidebar();
        lucide.createIcons();
        this.setupAIBar();

        await syncStateWithBackend();
        if (State.project) {
            document.getElementById('header-project-name').innerText = State.project.projectName;
            document.getElementById('welcome-screen').style.display = 'none';
            const layout = document.getElementById('app-layout');
            layout.classList.remove('opacity-0', 'pointer-events-none');
            this.navigateTo('dashboard');
        }
    },

    // --- NAVIGATION & RENDERING ---
    renderSidebar() {
        const navMenu = document.getElementById('nav-menu');
        navMenu.innerHTML = MODULES.map(m => `
                    <button onclick="App.navigateTo('${m.id}')" id="nav-${m.id}" class="nav-item w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted hover:bg-surface hover:text-textMain transition-all text-left">
                        <i data-lucide="${m.icon}" class="w-4 h-4"></i>
                        <span>${m.name}</span>
                    </button>
                `).join('');
    },

    async navigateTo(moduleId) {
        State.activeModule = moduleId;

        await syncStateWithBackend();

        // Update UI State
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        document.getElementById(`nav-${moduleId}`).classList.add('active');

        // Clear existing charts
        State.charts.forEach(chart => chart.destroy());
        State.charts = [];

        const workspace = document.getElementById('workspace');

        // GSAP Fade out
        gsap.to(workspace, {
            opacity: 0, duration: 0.2, onComplete: () => {
                workspace.innerHTML = this.getModuleContent(moduleId);
                lucide.createIcons();
                this.initModuleScripts(moduleId);

                // GSAP Fade in
                gsap.to(workspace, { opacity: 1, duration: 0.3 });

                // Stagger animate cards if present
                if (document.querySelectorAll('.animate-card').length) {
                    gsap.fromTo('.animate-card',
                        { y: 20, opacity: 0 },
                        { y: 0, opacity: 1, duration: 0.4, stagger: 0.05, ease: 'power2.out' }
                    );
                }
            }
        });

        this.updateAISuggestions(moduleId);
    },

    getModuleContent(id) {
        if (!State.project) return `<div class="flex items-center justify-center h-full text-muted">Please setup a project first.</div>`;

        switch (id) {
            case 'dashboard': return this.views.dashboard();
            case 'timeline': return this.views.timeline();
            case 'material': return this.views.material();
            case 'equipment': return this.views.equipment();
            case 'workforce': return this.views.workforce();
            case 'weather': return this.views.weather();
            case 'risk': return this.views.risk();
            case 'safety': return this.views.safety();
            case 'copilot': return this.views.copilot();
            default: return this.views.generic(id);
        }
    },

    initModuleScripts(id) {
        if (id === 'dashboard') this.scripts.initDashboard();
        if (id === 'timeline') this.scripts.initTimeline();
        if (id === 'material') this.scripts.initMaterial();
        if (id === 'equipment') this.scripts.initEquipment();
        if (id === 'workforce') this.scripts.initWorkforce();
        if (id === 'safety') this.scripts.initSafety();
        if (id === 'copilot') this.scripts.initCopilotScroll();
    },

    // --- VIEWS ---
    views: {
        dashboard() {
            return `
                        <div class="space-y-6">
                            <div class="flex justify-between items-end">
                                <div>
                                    <h1 class="text-2xl font-bold text-textMain">Executive Command Center</h1>
                                    <p class="text-muted text-sm mt-1">Real-time intelligence for ${State.project.projectName}</p>
                                </div>
                                <div class="flex gap-2">
                                    <button class="px-4 py-2 bg-surface border border-border rounded-lg text-sm font-medium hover:bg-border transition flex items-center gap-2">
                                        <i data-lucide="download" class="w-4 h-4"></i> Export Brief
                                    </button>
                                </div>
                            </div>

                            <!-- KPIs -->
                            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div class="animate-card bg-surface border border-border rounded-xl p-5 shadow-sm">
                                    <div class="text-muted text-xs font-medium uppercase tracking-wider mb-2 flex justify-between">Project Health <i data-lucide="activity" class="w-4 h-4 text-success"></i></div>
                                    <div class="text-3xl font-bold text-textMain">${State.metrics.health}%</div>
                                    <div class="text-xs text-success mt-2 flex items-center gap-1"><i data-lucide="trending-up" class="w-3 h-3"></i> Stable trajectory</div>
                                </div>
                                <div class="animate-card bg-surface border border-border rounded-xl p-5 shadow-sm">
                                    <div class="text-muted text-xs font-medium uppercase tracking-wider mb-2 flex justify-between">Cost Perf. Index <i data-lucide="dollar-sign" class="w-4 h-4 text-primary"></i></div>
                                    <div class="text-3xl font-bold text-textMain">${State.metrics.cpi}</div>
                                    <div class="text-xs text-success mt-2 flex items-center gap-1"><i data-lucide="arrow-up-right" class="w-3 h-3"></i> Under Budget</div>
                                </div>
                                <div class="animate-card bg-surface border border-border rounded-xl p-5 shadow-sm">
                                    <div class="text-muted text-xs font-medium uppercase tracking-wider mb-2 flex justify-between">Schedule Perf. <i data-lucide="clock" class="w-4 h-4 text-warning"></i></div>
                                    <div class="text-3xl font-bold text-textMain">${State.metrics.spi}</div>
                                    <div class="text-xs text-warning mt-2 flex items-center gap-1"><i data-lucide="alert-circle" class="w-3 h-3"></i> Slight delay on critical path</div>
                                </div>
                                <div class="animate-card bg-surface border border-border rounded-xl p-5 shadow-sm">
                                    <div class="text-muted text-xs font-medium uppercase tracking-wider mb-2 flex justify-between">Safety Score <i data-lucide="shield-check" class="w-4 h-4 text-success"></i></div>
                                    <div class="text-3xl font-bold text-textMain">${State.metrics.safety}/100</div>
                                    <div class="text-xs text-muted mt-2 flex items-center gap-1">0 LTI in last 45 days</div>
                                </div>
                            </div>

                            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <!-- AI Feed -->
                                <div class="animate-card lg:col-span-1 bg-surface border border-border rounded-xl flex flex-col shadow-sm h-[400px]">
                                    <div class="p-4 border-b border-border flex items-center gap-2">
                                        <i data-lucide="sparkles" class="w-4 h-4 text-primary"></i>
                                        <h3 class="font-semibold text-sm">AI Copilot Insights</h3>
                                    </div>
                                    <div class="p-4 flex-1 overflow-y-auto space-y-4">
                                        ${State.metrics.alerts.map(alert => `
                                            <div class="flex gap-3 items-start">
                                                <div class="w-2 h-2 rounded-full mt-1.5 ${alert.type === 'warning' ? 'bg-warning' : alert.type === 'danger' ? 'bg-danger' : 'bg-success'} flex-shrink-0"></div>
                                                <p class="text-sm text-textMain leading-relaxed">${alert.text}</p>
                                            </div>
                                        `).join('')}
                                        <div class="bg-primary/5 border border-primary/20 rounded-lg p-3">
                                            <p class="text-xs font-medium text-primary mb-1">Recommendation</p>
                                            <p class="text-sm text-textMain">Shift 2 excavators from Zone B to Zone A to mitigate substructure delay.</p>
                                            <button class="mt-2 text-xs bg-primary text-white px-2 py-1 rounded hover:bg-primaryHover transition">Apply Resource Shift</button>
                                        </div>
                                    </div>
                                </div>

                                <!-- Charts -->
                                <div class="animate-card lg:col-span-2 space-y-6">
                                    <div class="bg-surface border border-border rounded-xl p-5 shadow-sm h-[400px] flex flex-col">
                                        <h3 class="font-semibold text-sm mb-4">Cost Variance Forecast (S-Curve)</h3>
                                        <div class="flex-1 w-full relative">
                                            <canvas id="costChart"></canvas>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
        },

        timeline() {
            return `
                        <div class="space-y-6">
                            <div class="flex justify-between items-end">
                                <div>
                                    <h1 class="text-2xl font-bold text-textMain">Timeline Intelligence</h1>
                                    <p class="text-muted text-sm mt-1">AI-optimized critical path and delay forecasting.</p>
                                </div>
                            </div>
                            
                            <div class="animate-card bg-surface border border-border rounded-xl p-4 flex items-start gap-4">
                                <div class="p-2 bg-warning/10 rounded-lg text-warning flex-shrink-0">
                                    <i data-lucide="siren" class="w-5 h-5"></i>
                                </div>
                                <div>
                                    <h4 class="text-sm font-semibold">Delay Simulation Detected</h4>
                                    <p class="text-sm text-muted mt-1">Based on current weather forecasts and material delivery tracking, Activity A.4 (Level 2 Slab) has a 78% probability of a 3-day delay. This will impact the critical path.</p>
                                    <div class="flex gap-2 mt-3">
                                        <button class="text-xs bg-textMain text-surface px-3 py-1.5 rounded-md hover:bg-black transition">View AI Mitigation Plan</button>
                                        <button class="text-xs border border-border px-3 py-1.5 rounded-md hover:bg-border transition">Ignore</button>
                                    </div>
                                </div>
                            </div>

                            <div class="animate-card bg-surface border border-border rounded-xl shadow-sm overflow-hidden flex flex-col h-[500px]">
                                <div class="flex border-b border-border bg-background/50 text-xs font-medium text-muted">
                                    <div class="w-64 p-3 border-r border-border flex-shrink-0">Activity Name</div>
                                    <div class="flex-1 flex">
                                        <div class="flex-1 p-3 border-r border-border text-center">Week 1</div>
                                        <div class="flex-1 p-3 border-r border-border text-center">Week 2</div>
                                        <div class="flex-1 p-3 border-r border-border text-center bg-primary/5 text-primary">Week 3 (Current)</div>
                                        <div class="flex-1 p-3 border-r border-border text-center">Week 4</div>
                                        <div class="flex-1 p-3 text-center">Week 5</div>
                                    </div>
                                </div>
                                <div class="flex-1 overflow-y-auto" id="gantt-rows">
                                    <!-- Rendered via JS -->
                                </div>
                            </div>
                        </div>
                    `;
        },

        material() {
            return `
                        <div class="space-y-6">
                            <div class="flex justify-between items-end">
                                <div>
                                    <h1 class="text-2xl font-bold text-textMain">Material Intelligence</h1>
                                    <p class="text-muted text-sm mt-1">Predictive procurement, inventory tracking, and shortage forecasting.</p>
                                </div>
                            </div>

                            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div class="animate-card bg-surface border border-border rounded-xl p-5 shadow-sm">
                                    <div class="text-muted text-xs font-medium uppercase tracking-wider mb-2">Total Inventory Value</div>
                                    <div class="text-3xl font-bold text-textMain">$2.4M</div>
                                    <div class="text-xs text-muted mt-2">Across 3 staging areas</div>
                                </div>
                                <div class="animate-card bg-surface border border-border rounded-xl p-5 shadow-sm">
                                    <div class="text-muted text-xs font-medium uppercase tracking-wider mb-2 text-danger">Predicted Shortages</div>
                                    <div class="text-3xl font-bold text-textMain">2</div>
                                    <div class="text-xs text-danger mt-2">Impacting next 14 days</div>
                                </div>
                                <div class="animate-card bg-surface border border-border rounded-xl p-5 shadow-sm">
                                    <div class="text-muted text-xs font-medium uppercase tracking-wider mb-2">Supplier Reliability</div>
                                    <div class="text-3xl font-bold text-textMain">88%</div>
                                    <div class="text-xs text-success mt-2">+2% vs last quarter</div>
                                </div>
                                <div class="animate-card bg-surface border border-border rounded-xl p-5 shadow-sm">
                                    <div class="text-muted text-xs font-medium uppercase tracking-wider mb-2">Waste Index</div>
                                    <div class="text-3xl font-bold text-textMain">4.2%</div>
                                    <div class="text-xs text-muted mt-2">Below 5% target</div>
                                </div>
                            </div>

                            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div class="animate-card bg-surface border border-border rounded-xl p-5 shadow-sm h-[350px] flex flex-col">
                                    <h3 class="font-semibold text-sm mb-4">Concrete Procurement vs. Consumption (Monthly)</h3>
                                    <div class="flex-1 w-full relative">
                                        <canvas id="materialChart"></canvas>
                                    </div>
                                </div>

                                <div class="animate-card bg-surface border border-border rounded-xl flex flex-col shadow-sm">
                                    <div class="p-4 border-b border-border flex justify-between items-center bg-background/50">
                                        <h3 class="font-semibold text-sm">Critical Material Tracking</h3>
                                    </div>
                                    <div class="overflow-x-auto flex-1">
                                        <table class="w-full text-sm text-left">
                                            <thead class="text-xs text-muted uppercase bg-surface">
                                                <tr>
                                                    <th class="px-4 py-3">Material</th>
                                                    <th class="px-4 py-3">Stock</th>
                                                    <th class="px-4 py-3">Required (14d)</th>
                                                    <th class="px-4 py-3">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${State.materials.map(m => `
                                                    <tr class="border-b border-border hover:bg-background/50">
                                                        <td class="px-4 py-3">
                                                            <div class="font-medium text-textMain">${m.name}</div>
                                                            <div class="text-[10px] text-muted">${m.supplier}</div>
                                                        </td>
                                                        <td class="px-4 py-3 font-mono text-xs">${m.stock}</td>
                                                        <td class="px-4 py-3 font-mono text-xs">${m.required}</td>
                                                        <td class="px-4 py-3">
                                                            <span class="px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider ${m.status === 'Healthy' || m.status === 'On Track' ? 'bg-success/10 text-success' : m.status === 'Delayed' ? 'bg-danger/10 text-danger' : 'bg-warning/10 text-warning'}">${m.status}</span>
                                                        </td>
                                                    </tr>
                                                `).join('')}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
        },

        equipment() {
            return `
                        <div class="space-y-6">
                            <div class="flex justify-between items-end">
                                <div>
                                    <h1 class="text-2xl font-bold text-textMain">Equipment Intelligence</h1>
                                    <p class="text-muted text-sm mt-1">Fleet utilization, fuel tracking, and predictive maintenance.</p>
                                </div>
                            </div>

                            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div class="animate-card bg-surface border border-border rounded-xl p-5 shadow-sm">
                                    <div class="text-muted text-xs font-medium uppercase tracking-wider mb-2">Active Fleet</div>
                                    <div class="text-3xl font-bold text-textMain">24 <span class="text-base font-normal text-muted">/ 28</span></div>
                                </div>
                                <div class="animate-card bg-surface border border-border rounded-xl p-5 shadow-sm">
                                    <div class="text-muted text-xs font-medium uppercase tracking-wider mb-2">Avg Utilization</div>
                                    <div class="text-3xl font-bold text-textMain">76%</div>
                                    <div class="text-xs text-muted mt-2">Optimal range (70-85%)</div>
                                </div>
                                <div class="animate-card bg-surface border border-border rounded-xl p-5 shadow-sm">
                                    <div class="text-muted text-xs font-medium uppercase tracking-wider mb-2 text-warning">Downtime Costs</div>
                                    <div class="text-3xl font-bold text-textMain">$12.4k</div>
                                    <div class="text-xs text-warning mt-2">Month-to-date</div>
                                </div>
                                <div class="animate-card bg-surface border border-border rounded-xl p-5 shadow-sm">
                                    <div class="text-muted text-xs font-medium uppercase tracking-wider mb-2 text-primary">AI Recommendation</div>
                                    <div class="text-sm font-medium text-textMain mt-1 leading-tight">Reallocate Concrete Pump PMP-02 to Zone C to reduce idle time.</div>
                                </div>
                            </div>

                            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                <div class="animate-card lg:col-span-1 bg-surface border border-border rounded-xl p-5 shadow-sm h-[350px] flex flex-col items-center">
                                    <h3 class="font-semibold text-sm mb-4 w-full text-left">Fleet Status Distribution</h3>
                                    <div class="flex-1 w-full relative max-w-[200px]">
                                        <canvas id="equipmentChart"></canvas>
                                    </div>
                                </div>

                                <div class="animate-card lg:col-span-2 bg-surface border border-border rounded-xl flex flex-col shadow-sm">
                                    <div class="p-4 border-b border-border flex justify-between items-center bg-background/50">
                                        <h3 class="font-semibold text-sm">Heavy Machinery Registry</h3>
                                    </div>
                                    <div class="overflow-x-auto flex-1">
                                        <table class="w-full text-sm text-left">
                                            <thead class="text-xs text-muted uppercase bg-surface">
                                                <tr>
                                                    <th class="px-4 py-3">ID / Model</th>
                                                    <th class="px-4 py-3">Status</th>
                                                    <th class="px-4 py-3">Operator</th>
                                                    <th class="px-4 py-3">Fuel/Power</th>
                                                    <th class="px-4 py-3">Utilization</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${State.equipment.map(e => `
                                                    <tr class="border-b border-border hover:bg-background/50">
                                                        <td class="px-4 py-3">
                                                            <div class="font-medium text-textMain">${e.id}</div>
                                                            <div class="text-[10px] text-muted">${e.model}</div>
                                                        </td>
                                                        <td class="px-4 py-3">
                                                            <span class="px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider ${e.status === 'Active' ? 'bg-success/10 text-success' : e.status === 'Idle' ? 'bg-warning/10 text-warning' : 'bg-danger/10 text-danger'}">${e.status}</span>
                                                        </td>
                                                        <td class="px-4 py-3 text-xs text-muted">${e.operator}</td>
                                                        <td class="px-4 py-3 text-xs text-muted">${e.fuel}</td>
                                                        <td class="px-4 py-3">
                                                            <div class="w-full bg-border rounded-full h-1.5 mt-1">
                                                                <div class="bg-primary h-1.5 rounded-full" style="width: ${e.utilization}%"></div>
                                                            </div>
                                                            <div class="text-[10px] text-right mt-1 text-muted">${e.utilization}%</div>
                                                        </td>
                                                    </tr>
                                                `).join('')}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
        },

        workforce() {
            return `
                        <div class="space-y-6">
                            <div class="flex justify-between items-end">
                                <div>
                                    <h1 class="text-2xl font-bold text-textMain">Workforce Intelligence</h1>
                                    <p class="text-muted text-sm mt-1">Labor tracking, productivity analysis, and contractor performance.</p>
                                </div>
                            </div>

                            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div class="animate-card bg-surface border border-border rounded-xl p-5 shadow-sm">
                                    <div class="text-muted text-xs font-medium uppercase tracking-wider mb-2">Total On-Site</div>
                                    <div class="text-3xl font-bold text-textMain">342</div>
                                    <div class="text-xs text-success mt-2">+12 vs Planned</div>
                                </div>
                                <div class="animate-card bg-surface border border-border rounded-xl p-5 shadow-sm">
                                    <div class="text-muted text-xs font-medium uppercase tracking-wider mb-2">Labor Productivity</div>
                                    <div class="text-3xl font-bold text-textMain">92%</div>
                                    <div class="text-xs text-muted mt-2">Earned hours / Actual hours</div>
                                </div>
                                <div class="animate-card bg-surface border border-border rounded-xl p-5 shadow-sm">
                                    <div class="text-muted text-xs font-medium uppercase tracking-wider mb-2 text-warning">Overtime Burn</div>
                                    <div class="text-3xl font-bold text-textMain">14%</div>
                                    <div class="text-xs text-warning mt-2">High risk in MEP trades</div>
                                </div>
                                <div class="animate-card bg-surface border border-border rounded-xl p-5 shadow-sm">
                                    <div class="text-muted text-xs font-medium uppercase tracking-wider mb-2">Active Contractors</div>
                                    <div class="text-3xl font-bold text-textMain">8</div>
                                </div>
                            </div>

                            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div class="animate-card bg-surface border border-border rounded-xl p-5 shadow-sm h-[350px] flex flex-col">
                                    <h3 class="font-semibold text-sm mb-4">Headcount vs Planned (By Trade)</h3>
                                    <div class="flex-1 w-full relative">
                                        <canvas id="workforceChart"></canvas>
                                    </div>
                                </div>

                                <div class="animate-card bg-surface border border-border rounded-xl flex flex-col shadow-sm">
                                    <div class="p-4 border-b border-border flex justify-between items-center bg-background/50">
                                        <h3 class="font-semibold text-sm">Contractor Performance Matrix</h3>
                                    </div>
                                    <div class="overflow-x-auto flex-1">
                                        <table class="w-full text-sm text-left">
                                            <thead class="text-xs text-muted uppercase bg-surface">
                                                <tr>
                                                    <th class="px-4 py-3">Trade / Contractor</th>
                                                    <th class="px-4 py-3">Actual / Plan</th>
                                                    <th class="px-4 py-3">Variance</th>
                                                    <th class="px-4 py-3">Productivity</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${State.workforce.map(w => `
                                                    <tr class="border-b border-border hover:bg-background/50">
                                                        <td class="px-4 py-3">
                                                            <div class="font-medium text-textMain">${w.trade}</div>
                                                            <div class="text-[10px] text-muted">${w.contractor}</div>
                                                        </td>
                                                        <td class="px-4 py-3 font-mono text-xs">${w.headcount} / ${w.plan}</td>
                                                        <td class="px-4 py-3">
                                                            <span class="px-2 py-1 rounded text-[10px] font-bold ${w.variance.startsWith('-') ? 'bg-danger/10 text-danger' : w.variance === '0' ? 'bg-surface text-muted' : 'bg-success/10 text-success'}">${w.variance}</span>
                                                        </td>
                                                        <td class="px-4 py-3 font-mono text-xs">${w.productivity}</td>
                                                    </tr>
                                                `).join('')}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
        },

        weather() {
            const report = State.weather_report || {
                temp: "24", desc: "Partly Cloudy", wind: "14 km/h", humidity: "62%", precip: "0 mm", aqi: "45 (Good)",
                forecast: [
                    { day: "Mon", temp: "22", desc: "Clear", icon: "sun", risk: "Clear" },
                    { day: "Tue", temp: "23", desc: "Clear", icon: "sun", risk: "Clear" },
                    { day: "Wed", temp: "24", desc: "Partly Cloudy", icon: "cloud", risk: "Clear" },
                    { day: "Thu", temp: "25", desc: "Storm", icon: "cloud-lightning", risk: "Crane Risk" },
                    { day: "Fri", temp: "26", desc: "Windy", icon: "cloud-lightning", risk: "Crane Risk" },
                    { day: "Sat", temp: "23", desc: "Clear", icon: "sun", risk: "Clear" },
                    { day: "Sun", temp: "22", desc: "Clear", icon: "sun", risk: "Clear" }
                ]
            };

            return `
                        <div class="space-y-6">
                            <div class="flex justify-between items-end">
                                <div>
                                    <h1 class="text-2xl font-bold text-textMain">Weather Intelligence</h1>
                                    <p class="text-muted text-sm mt-1">Hyper-local forecasting and automated schedule impact simulation.</p>
                                </div>
                            </div>

                            <div class="animate-card bg-primary text-white rounded-xl p-6 shadow-sm flex items-center justify-between relative overflow-hidden">
                                <div class="absolute -right-10 -top-10 opacity-20 transform scale-150 pointer-events-none">
                                    <i data-lucide="cloud-rain" class="w-64 h-64"></i>
                                </div>
                                <div class="relative z-10 flex gap-8 items-center">
                                    <div>
                                        <div class="text-sm font-medium opacity-80 uppercase tracking-wider">Current Conditions</div>
                                        <div class="text-5xl font-bold mt-1">${report.temp}°C</div>
                                        <div class="text-sm mt-2 font-medium">${report.desc} • ${State.project.projectName} Site</div>
                                    </div>
                                    <div class="h-16 w-px bg-white/20 hidden md:block"></div>
                                    <div class="grid grid-cols-2 gap-x-8 gap-y-2">
                                        <div>
                                            <div class="text-xs opacity-80">Wind Speed</div>
                                            <div class="font-semibold">${report.wind}</div>
                                        </div>
                                        <div>
                                            <div class="text-xs opacity-80">Humidity</div>
                                            <div class="font-semibold">${report.humidity}</div>
                                        </div>
                                        <div>
                                            <div class="text-xs opacity-80">Precipitation</div>
                                            <div class="font-semibold">${report.precip}</div>
                                        </div>
                                        <div>
                                            <div class="text-xs opacity-80">Air Quality</div>
                                            <div class="font-semibold">${report.aqi}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <h3 class="font-semibold text-sm mt-8">7-Day Forecast</h3>
                            <div class="grid grid-cols-2 md:grid-cols-7 gap-3">
                                ${report.forecast.map((f, i) => {
                                    const isRisk = f.risk !== "Clear";
                                    return `
                                        <div class="animate-card bg-surface border ${isRisk ? 'border-warning/50 bg-warning/5' : 'border-border'} rounded-xl p-4 text-center flex flex-col items-center justify-center gap-2">
                                            <div class="text-xs font-semibold uppercase ${isRisk ? 'text-warning' : 'text-muted'}">${f.day}</div>
                                            <i data-lucide="${f.icon}" class="w-6 h-6 ${isRisk ? 'text-warning' : 'text-textMain'}"></i>
                                            <div class="font-bold text-lg">${f.temp}°</div>
                                            <div class="text-[10px] ${isRisk ? 'bg-warning/20 text-warning px-2 py-0.5 rounded font-bold' : 'text-muted'}">${f.risk}</div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>

                            <div class="animate-card bg-surface border border-border rounded-xl p-5 mt-6 flex items-start gap-4">
                                <div class="p-2 bg-primary/10 rounded-lg text-primary flex-shrink-0">
                                    <i data-lucide="bot" class="w-5 h-5"></i>
                                </div>
                                <div>
                                    <h4 class="text-sm font-semibold">Copilot Schedule Impact Analysis</h4>
                                    <p class="text-sm text-muted mt-1">Weather conditions for the upcoming week have been analyzed. If high winds (>30 km/h) or storms are present, crane operations and facade works are flagged as high risk.</p>
                                </div>
                            </div>
                        </div>
                    `;
        },

        risk() {
            return `
                        <div class="space-y-6">
                            <div>
                                <h1 class="text-2xl font-bold text-textMain">Risk Intelligence</h1>
                                <p class="text-muted text-sm mt-1">Predictive risk matrix and automated mitigation tracking.</p>
                            </div>

                            <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div class="animate-card md:col-span-2 bg-surface border border-border rounded-xl p-5">
                                    <h3 class="font-semibold text-sm mb-4">Risk Register</h3>
                                    <div class="overflow-x-auto">
                                        <table class="w-full text-sm text-left">
                                            <thead class="text-xs text-muted uppercase bg-background">
                                                <tr>
                                                    <th class="px-4 py-3 rounded-tl-lg">ID</th>
                                                    <th class="px-4 py-3">Description</th>
                                                    <th class="px-4 py-3">Probability</th>
                                                    <th class="px-4 py-3">Impact</th>
                                                    <th class="px-4 py-3 rounded-tr-lg">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${State.risks.map(r => `
                                                    <tr class="border-b border-border last:border-0 hover:bg-background/50">
                                                        <td class="px-4 py-3 font-medium">${r.id}</td>
                                                        <td class="px-4 py-3">${r.desc}</td>
                                                        <td class="px-4 py-3">
                                                            <span class="px-2 py-1 rounded text-xs ${r.prob === 'High' ? 'bg-danger/10 text-danger' : 'bg-warning/10 text-warning'}">${r.prob}</span>
                                                        </td>
                                                        <td class="px-4 py-3">
                                                            <span class="px-2 py-1 rounded text-xs ${r.impact === 'High' ? 'bg-danger/10 text-danger' : 'bg-warning/10 text-warning'}">${r.impact}</span>
                                                        </td>
                                                        <td class="px-4 py-3 text-muted">${r.status}</td>
                                                    </tr>
                                                `).join('')}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                                <div class="animate-card md:col-span-1 bg-surface border border-border rounded-xl p-5">
                                    <h3 class="font-semibold text-sm mb-4">AI Risk Heatmap</h3>
                                    <!-- Simplified 3x3 for visual appeal in tight space -->
                                    <div class="grid grid-cols-3 grid-rows-3 gap-1 h-48">
                                        <div class="bg-warning/40 rounded-tl-lg flex items-center justify-center text-xs font-medium">1</div>
                                        <div class="bg-danger/60 flex items-center justify-center text-xs font-medium">2</div>
                                        <div class="bg-danger/90 rounded-tr-lg flex items-center justify-center text-xs font-medium text-white">1</div>
                                        
                                        <div class="bg-success/40 flex items-center justify-center text-xs font-medium">3</div>
                                        <div class="bg-warning/60 flex items-center justify-center text-xs font-medium text-white">4</div>
                                        <div class="bg-danger/60 flex items-center justify-center text-xs font-medium text-white">2</div>
                                        
                                        <div class="bg-success/20 rounded-bl-lg flex items-center justify-center text-xs font-medium">8</div>
                                        <div class="bg-success/40 flex items-center justify-center text-xs font-medium">5</div>
                                        <div class="bg-warning/40 rounded-br-lg flex items-center justify-center text-xs font-medium">3</div>
                                    </div>
                                    <div class="mt-4 text-xs text-muted flex justify-between">
                                        <span>Low Impact/Prob</span>
                                        <span>High Impact/Prob</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
        },

        safety() {
            return `
                        <div class="space-y-6">
                            <div class="flex justify-between items-end">
                                <div>
                                    <h1 class="text-2xl font-bold text-textMain">Safety Intelligence</h1>
                                    <p class="text-muted text-sm mt-1">Incident tracking, predictive hazard modeling, and compliance.</p>
                                </div>
                                <button class="px-4 py-2 bg-textMain text-surface rounded-lg text-sm font-medium hover:bg-black transition flex items-center gap-2">
                                    <i data-lucide="plus" class="w-4 h-4"></i> Log Incident
                                </button>
                            </div>

                            <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div class="animate-card bg-surface border border-border rounded-xl p-5 shadow-sm">
                                    <div class="text-muted text-xs font-medium uppercase tracking-wider mb-2">LTI Free Days</div>
                                    <div class="text-3xl font-bold text-success">142</div>
                                    <div class="text-xs text-muted mt-2">Target: 365 Days</div>
                                </div>
                                <div class="animate-card bg-surface border border-border rounded-xl p-5 shadow-sm">
                                    <div class="text-muted text-xs font-medium uppercase tracking-wider mb-2">Total Incidents (MTD)</div>
                                    <div class="text-3xl font-bold text-textMain">4</div>
                                    <div class="text-xs text-warning mt-2">Mostly minor / near miss</div>
                                </div>
                                <div class="animate-card bg-surface border border-border rounded-xl p-5 shadow-sm">
                                    <div class="text-muted text-xs font-medium uppercase tracking-wider mb-2">Audit Compliance</div>
                                    <div class="text-3xl font-bold text-textMain">98%</div>
                                    <div class="text-xs text-success mt-2">All weekly audits closed</div>
                                </div>
                                <div class="animate-card bg-surface border border-border rounded-xl p-5 shadow-sm flex flex-col justify-center bg-danger/5 border-danger/20">
                                    <div class="text-danger text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-1"><i data-lucide="alert-triangle" class="w-3 h-3"></i> High Risk Zone</div>
                                    <div class="text-sm font-semibold text-textMain leading-tight">Zone B, Level 2 Edge Work</div>
                                </div>
                            </div>

                            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                <div class="animate-card bg-surface border border-border rounded-xl p-5 shadow-sm h-[350px] flex flex-col">
                                    <h3 class="font-semibold text-sm mb-4">Incident Trends by Type</h3>
                                    <div class="flex-1 w-full relative">
                                        <canvas id="safetyChart"></canvas>
                                    </div>
                                </div>

                                <div class="animate-card bg-surface border border-border rounded-xl flex flex-col shadow-sm">
                                    <div class="p-4 border-b border-border flex justify-between items-center bg-background/50">
                                        <h3 class="font-semibold text-sm">Recent Safety Logs</h3>
                                    </div>
                                    <div class="overflow-x-auto flex-1">
                                        <table class="w-full text-sm text-left">
                                            <thead class="text-xs text-muted uppercase bg-surface">
                                                <tr>
                                                    <th class="px-4 py-3">ID / Date</th>
                                                    <th class="px-4 py-3">Type</th>
                                                    <th class="px-4 py-3">Description</th>
                                                    <th class="px-4 py-3">Sev.</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                ${State.safety.map(s => `
                                                    <tr class="border-b border-border hover:bg-background/50">
                                                        <td class="px-4 py-3">
                                                            <div class="font-medium text-primary cursor-pointer hover:underline">${s.id}</div>
                                                            <div class="text-[10px] text-muted">${s.date}</div>
                                                        </td>
                                                        <td class="px-4 py-3 text-xs font-medium text-muted">${s.type}</td>
                                                        <td class="px-4 py-3">
                                                            <div class="text-xs text-textMain truncate max-w-[150px]">${s.desc}</div>
                                                            <div class="text-[10px] text-muted">${s.location}</div>
                                                        </td>
                                                        <td class="px-4 py-3">
                                                            <span class="px-2 py-1 rounded text-[10px] uppercase font-bold tracking-wider ${s.severity === 'Low' || s.severity === 'Info' ? 'bg-success/10 text-success' : s.severity === 'Medium' ? 'bg-warning/10 text-warning' : 'bg-danger/10 text-danger'}">${s.severity}</span>
                                                        </td>
                                                    </tr>
                                                `).join('')}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
        },

        copilot() {
            return `
                        <div class="flex flex-col h-[calc(100vh-140px)] -mt-6 -mx-6">
                            <div class="p-6 border-b border-border bg-surface/50 backdrop-blur-sm flex justify-between items-center z-10">
                                <div>
                                    <h1 class="text-xl font-bold ai-gradient-text flex items-center gap-2">
                                        <i data-lucide="sparkles" class="w-5 h-5 text-primary"></i> Construction Copilot
                                    </h1>
                                    <p class="text-xs text-muted mt-1">Context: ${State.project.projectName} • Upload documents via the chat bar below</p>
                                </div>
                                <button class="text-xs border border-border px-3 py-1.5 rounded-md hover:bg-border transition flex items-center gap-2 bg-background">
                                    <i data-lucide="file-text" class="w-3 h-3"></i> Generate Report
                                </button>
                            </div>
                            
                            <div class="flex-1 overflow-y-auto p-6 space-y-6" id="chat-history-container">
                                <div class="flex gap-4 max-w-3xl">
                                    <div class="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                                        <i data-lucide="bot" class="w-4 h-4 text-primary"></i>
                                    </div>
                                    <div class="space-y-1">
                                        <div class="text-xs font-medium text-muted">Copilot</div>
                                        <div class="bg-surface border border-border p-4 rounded-2xl rounded-tl-sm text-sm text-textMain leading-relaxed">
                                            Hello. I am analyzing the latest data for ${State.project.projectName}. Upload drawings, RFIs, or specs using the paperclip in the chat bar and I will analyze them for clashes, missing information, and schedule impact.
                                        </div>
                                    </div>
                                </div>
                                ${State.chatHistory.map(msg => `
                                    <div class="flex gap-4 max-w-3xl ${msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''}">
                                        <div class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'user' ? 'bg-textMain text-surface' : 'bg-primary/10 border border-primary/20'}">
                                            <i data-lucide="${msg.role === 'user' ? 'user' : 'bot'}" class="w-4 h-4 ${msg.role === 'user' ? '' : 'text-primary'}"></i>
                                        </div>
                                        <div class="space-y-1 ${msg.role === 'user' ? 'text-right' : ''}">
                                            <div class="text-xs font-medium text-muted">${msg.role === 'user' ? 'You' : 'Copilot'}</div>
                                            <div class="${msg.role === 'user' ? 'bg-textMain text-surface' : 'bg-surface border border-border text-textMain'} p-4 rounded-2xl ${msg.role === 'user' ? 'rounded-tr-sm' : 'rounded-tl-sm'} text-sm whitespace-pre-wrap leading-relaxed">
                                                ${msg.text}
                                                ${msg.attachment ? `
                                                    <div class="mt-2 inline-flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2 text-xs ${msg.role === 'user' ? 'text-left' : ''}">
                                                        <i data-lucide="file-text" class="w-4 h-4 text-primary"></i>
                                                        <div>
                                                            <div class="font-medium text-textMain">${msg.attachment.name}</div>
                                                            <div class="text-muted">${msg.attachment.type} • ${msg.attachment.size}</div>
                                                        </div>
                                                    </div>
                                                ` : ''}
                                            </div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                            <!-- Note: The main input bar is global, so we just pad the bottom -->
                            <div class="h-24 flex-shrink-0"></div>
                        </div>
                    `;
        },

        generic(id) {
            const moduleName = MODULES.find(m => m.id === id)?.name || id;
            return `
                        <div class="animate-card flex flex-col items-center justify-center h-full text-center space-y-4">
                            <div class="w-16 h-16 bg-surface border border-border rounded-full flex items-center justify-center text-muted">
                                <i data-lucide="cpu" class="w-8 h-8"></i>
                            </div>
                            <div>
                                <h2 class="text-xl font-semibold">${moduleName} Connected</h2>
                                <p class="text-sm text-muted mt-2 max-w-md">The AI engine is actively monitoring data streams for this module. Cross-module intelligence routing is active.</p>
                            </div>
                        </div>
                    `;
        }
    },

    // --- SCRIPT INITIALIZERS FOR VIEWS ---
    scripts: {
        initDashboard() {
            const ctx = document.getElementById('costChart').getContext('2d');
            const chart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
                    datasets: [
                        {
                            label: 'Planned Value',
                            data: [10, 25, 45, 60, 75, 90, 100],
                            borderColor: '#E8E2D7',
                            borderDash: [5, 5],
                            tension: 0.4
                        },
                        {
                            label: 'Earned Value',
                            data: [10, 22, 40, 58, 70],
                            borderColor: '#5B8A72',
                            backgroundColor: 'rgba(91, 138, 114, 0.1)',
                            fill: true,
                            tension: 0.4
                        },
                        {
                            label: 'Actual Cost',
                            data: [12, 28, 48, 62, 75],
                            borderColor: '#D97757',
                            tension: 0.4
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom', labels: { boxWidth: 12, font: { family: 'Inter', size: 11 } } }
                    },
                    scales: {
                        y: { display: false },
                        x: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 10 } } }
                    }
                }
            });
            State.charts.push(chart);
        },

        initMaterial() {
            const ctx = document.getElementById('materialChart').getContext('2d');
            const chart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
                    datasets: [
                        {
                            label: 'Procured',
                            data: [120, 150, 180, 90],
                            backgroundColor: '#726B63',
                            borderRadius: 4
                        },
                        {
                            label: 'Consumed',
                            data: [100, 140, 190, 110], /* Deliberate over-consumption in W3/W4 to show risk */
                            backgroundColor: '#D97757',
                            borderRadius: 4
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom', labels: { boxWidth: 12, font: { family: 'Inter', size: 11 } } }
                    },
                    scales: {
                        y: { grid: { color: '#E8E2D7', borderDash: [5, 5] }, ticks: { font: { family: 'Inter', size: 10 } } },
                        x: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 10 } } }
                    }
                }
            });
            State.charts.push(chart);
        },

        initEquipment() {
            const ctx = document.getElementById('equipmentChart').getContext('2d');
            const chart = new Chart(ctx, {
                type: 'doughnut',
                data: {
                    labels: ['Active', 'Idle', 'Maintenance'],
                    datasets: [{
                        data: [24, 3, 1],
                        backgroundColor: ['#5B8A72', '#C18B3B', '#B95D4C'],
                        borderWidth: 0,
                        hoverOffset: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    cutout: '75%',
                    plugins: {
                        legend: { position: 'bottom', labels: { boxWidth: 12, font: { family: 'Inter', size: 11 } } }
                    }
                }
            });
            State.charts.push(chart);
        },

        initWorkforce() {
            const ctx = document.getElementById('workforceChart').getContext('2d');
            const chart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['Carpenters', 'Steel Fixers', 'MEP', 'General'],
                    datasets: [
                        {
                            label: 'Planned',
                            data: [40, 35, 12, 60],
                            backgroundColor: '#E8E2D7',
                            borderRadius: 4
                        },
                        {
                            label: 'Actual',
                            data: [45, 28, 12, 60],
                            backgroundColor: '#2F2B27',
                            borderRadius: 4
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom', labels: { boxWidth: 12, font: { family: 'Inter', size: 11 } } }
                    },
                    scales: {
                        y: { grid: { color: '#E8E2D7', borderDash: [5, 5] }, ticks: { font: { family: 'Inter', size: 10 } } },
                        x: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 10 } } }
                    }
                }
            });
            State.charts.push(chart);
        },

        initSafety() {
            const ctx = document.getElementById('safetyChart').getContext('2d');
            const chart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                    datasets: [
                        {
                            label: 'Near Misses',
                            data: [5, 3, 6, 2, 4, 3],
                            borderColor: '#C18B3B',
                            backgroundColor: 'rgba(193, 139, 59, 0.1)',
                            fill: true,
                            tension: 0.4
                        },
                        {
                            label: 'Unsafe Acts',
                            data: [2, 1, 3, 1, 2, 1],
                            borderColor: '#B95D4C',
                            tension: 0.4
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { position: 'bottom', labels: { boxWidth: 12, font: { family: 'Inter', size: 11 } } }
                    },
                    scales: {
                        y: { grid: { color: '#E8E2D7', borderDash: [5, 5] }, ticks: { font: { family: 'Inter', size: 10 }, stepSize: 2 } },
                        x: { grid: { display: false }, ticks: { font: { family: 'Inter', size: 10 } } }
                    }
                }
            });
            State.charts.push(chart);
        },

        initTimeline() {
            const rows = [
                { name: 'Site Preparation', start: 0, length: 1, status: 'complete', critical: false },
                { name: 'Excavation', start: 1, length: 2, status: 'complete', critical: true },
                { name: 'Foundation Pour', start: 3, length: 1, status: 'active', critical: true },
                { name: 'Substructure Walls', start: 4, length: 2, status: 'pending', critical: true, warning: true },
                { name: 'Waterproofing', start: 4.5, length: 1.5, status: 'pending', critical: false }
            ];

            const container = document.getElementById('gantt-rows');
            container.innerHTML = rows.map(r => `
                        <div class="flex border-b border-border hover:bg-background/50 transition">
                            <div class="w-64 p-3 border-r border-border flex items-center gap-2 text-sm">
                                ${r.warning ? '<i data-lucide="alert-triangle" class="w-4 h-4 text-warning"></i>' : ''}
                                <span class="${r.critical ? 'font-semibold' : ''}">${r.name}</span>
                            </div>
                            <div class="flex-1 relative">
                                <!-- Grid Lines -->
                                <div class="absolute inset-0 flex">
                                    <div class="flex-1 border-r border-border/50"></div>
                                    <div class="flex-1 border-r border-border/50"></div>
                                    <div class="flex-1 border-r border-border/50 bg-primary/5"></div>
                                    <div class="flex-1 border-r border-border/50"></div>
                                    <div class="flex-1"></div>
                                </div>
                                <!-- Bar -->
                                <div class="absolute top-1/2 -translate-y-1/2 h-6 rounded-md shadow-sm border ${r.status === 'complete' ? 'bg-success/20 border-success/30' :
                    r.status === 'active' ? 'bg-primary border-primary text-white' :
                        r.warning ? 'bg-warning/20 border-warning/50 stripe-pattern' :
                            'bg-surface border-border'
                }" style="left: ${r.start * 20}%; width: ${r.length * 20}%;">
                                </div>
                            </div>
                        </div>
                    `).join('');
        },

        initCopilotScroll() {
            const c = document.getElementById('chat-history-container');
            if (c) c.scrollTop = c.scrollHeight;
        }
    },

    // --- AI BAR LOGIC ---
    setupAIBar() {
        const input = document.getElementById('ai-input');
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.submitAIChat();
        });
    },

    formatFileSize(bytes) {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    },

    getFileTypeLabel(file) {
        const ext = file.name.split('.').pop()?.toLowerCase() || '';
        const types = {
            pdf: 'PDF Document',
            doc: 'Word Document',
            docx: 'Word Document',
            dwg: 'CAD Drawing',
            dxf: 'CAD Drawing',
            xls: 'Spreadsheet',
            xlsx: 'Spreadsheet',
            png: 'Image',
            jpg: 'Image',
            jpeg: 'Image',
            csv: 'Data File'
        };
        return types[ext] || 'Document';
    },

    renderAttachmentChips() {
        const container = document.getElementById('ai-attachments');
        if (!State.pendingUploads.length) {
            container.classList.add('hidden');
            container.innerHTML = '';
            return;
        }

        container.classList.remove('hidden');
        container.innerHTML = State.pendingUploads.map((file, idx) => `
            <span class="ai-attachment-chip">
                <i data-lucide="file-text" class="w-3 h-3 text-primary"></i>
                <span class="truncate max-w-[140px]">${file.name}</span>
                <button type="button" onclick="App.removePendingUpload(${idx})" class="text-muted hover:text-danger transition-colors">
                    <i data-lucide="x" class="w-3 h-3"></i>
                </button>
            </span>
        `).join('');
        lucide.createIcons();
    },

    removePendingUpload(index) {
        State.pendingUploads.splice(index, 1);
        this.renderAttachmentChips();
    },

    handleDocumentUpload(event) {
        const files = Array.from(event.target.files || []);
        if (!files.length) return;

        if (!State.project) {
            alert('Please create a project first before uploading documents.');
            event.target.value = '';
            return;
        }

        State.pendingUploads.push(...files);
        this.renderAttachmentChips();
        event.target.value = '';

        if (State.activeModule !== 'copilot') {
            this.navigateTo('copilot');
            setTimeout(() => this.processDocumentUploads(files), 500);
        } else {
            this.processDocumentUploads(files);
        }
    },

    async processDocumentUploads(files) {
        State.pendingUploads = State.pendingUploads.filter(
            pending => !files.some(file => file.name === pending.name && file.size === pending.size)
        );
        this.renderAttachmentChips();

        for (const file of files) {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("projectName", State.project?.projectName || "");
            formData.append("client", State.project?.client || "");
            formData.append("location", State.project?.location || "");

            if (State.activeModule !== 'copilot') {
                await this.navigateTo('copilot');
            }

            const container = document.getElementById('chat-history-container');
            const loaderId = 'loader-upload-' + Date.now();
            if (container) {
                container.innerHTML += `
                    <div id="${loaderId}" class="flex gap-4 max-w-3xl mb-6 ml-auto flex-row-reverse">
                        <div class="w-8 h-8 rounded-full bg-textMain text-surface flex items-center justify-center flex-shrink-0">
                            <i data-lucide="user" class="w-4 h-4"></i>
                        </div>
                        <div class="space-y-1 text-right">
                            <div class="text-xs font-medium text-muted">You</div>
                            <div class="bg-surface border border-border p-4 rounded-2xl rounded-tr-sm text-sm text-textMain flex items-center gap-2">
                                <div class="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                                <span>Uploading & indexing ${file.name}...</span>
                            </div>
                        </div>
                    </div>
                `;
                lucide.createIcons();
                container.scrollTop = container.scrollHeight;
            }

            try {
                const res = await fetch(`${API_URL}/api/upload`, {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();
                
                const loaderEl = document.getElementById(loaderId);
                if (loaderEl) loaderEl.remove();

                await syncStateWithBackend();
                this.refreshCopilotChat();
            } catch (e) {
                console.error("Error uploading file:", e);
                const loaderEl = document.getElementById(loaderId);
                if (loaderEl) loaderEl.remove();
                alert(`Failed to upload ${file.name}. Is the backend running?`);
            }
        }
    },

    refreshCopilotChat() {
        if (State.activeModule !== 'copilot') return;

        const workspace = document.getElementById('workspace');
        workspace.innerHTML = this.views.copilot();
        lucide.createIcons();
        this.scripts.initCopilotScroll();
    },

    appendChatMessage(role, text, attachment = null) {
        const container = document.getElementById('chat-history-container');
        if (!container) return;

        const attachmentHtml = attachment ? `
            <div class="mt-2 inline-flex items-center gap-2 bg-background border border-border rounded-lg px-3 py-2 text-xs">
                <i data-lucide="file-text" class="w-4 h-4 text-primary"></i>
                <div class="text-left">
                    <div class="font-medium text-textMain">${attachment.name}</div>
                    <div class="text-muted">${attachment.type} • ${attachment.size}</div>
                </div>
            </div>
        ` : '';

        container.innerHTML += `
            <div class="flex gap-4 max-w-3xl mb-6 ${role === 'user' ? 'ml-auto flex-row-reverse' : ''}">
                <div class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${role === 'user' ? 'bg-textMain text-surface' : 'bg-primary/10 border border-primary/20'}">
                    <i data-lucide="${role === 'user' ? 'user' : 'bot'}" class="w-4 h-4 ${role === 'user' ? '' : 'text-primary'}"></i>
                </div>
                <div class="space-y-1 ${role === 'user' ? 'text-right' : ''}">
                    <div class="text-xs font-medium text-muted">${role === 'user' ? 'You' : 'Copilot'}</div>
                    <div class="${role === 'user' ? 'bg-textMain text-surface' : 'bg-surface border border-border text-textMain'} p-4 rounded-2xl ${role === 'user' ? 'rounded-tr-sm' : 'rounded-tl-sm'} text-sm whitespace-pre-wrap leading-relaxed">${text}${attachmentHtml}</div>
                </div>
            </div>
        `;
        lucide.createIcons();
        container.scrollTop = container.scrollHeight;
    },

    showDocumentAnalysis(files) {
        const fileNames = files.map(f => f.name).join(', ');
        const primaryFile = files[0];
        const isDrawing = /\.(dwg|dxf|pdf)$/i.test(primaryFile.name);

        setTimeout(() => {
            this.showAILoadingAndRespond(`Analyze uploaded document: ${fileNames}`, {
                isDocumentUpload: true,
                fileName: primaryFile.name,
                isDrawing
            });
        }, 300);
    },

    updateAISuggestions(moduleId) {
        const container = document.getElementById('ai-suggestions');
        const suggestions = {
            dashboard: ['Summarize project health', 'Generate executive report', 'Why is SPI low?'],
            timeline: ['Predict project delays', 'Critical path analysis', 'Optimize schedule'],
            material: ['Forecast steel shortage', 'Optimize procurement', 'Show supplier ratings'],
            equipment: ['Optimize crane allocation', 'Maintenance forecasting', 'Downtime cost analysis'],
            workforce: ['Predict labor shortage', 'Overtime impact analysis', 'Crew productivity'],
            weather: ['Schedule weather impact', 'Rain delay forecast', 'Wind risk analysis'],
            risk: ['Analyze top 3 risks', 'Suggest mitigations for R01', 'Update risk register'],
            safety: ['Identify high risk zones', 'Analyze recent near misses', 'Generate safety report'],
            copilot: ['Upload a drawing for clash check', 'Summarize uploaded document', 'Find missing information'],
            default: ['Analyze data', 'Find anomalies', 'Generate summary']
        };

        const list = suggestions[moduleId] || suggestions.default;

        // Clear existing (keep the label)
        while (container.childNodes.length > 2) {
            container.removeChild(container.lastChild);
        }

        list.forEach(text => {
            const btn = document.createElement('button');
            btn.className = 'text-xs bg-surface border border-border px-3 py-1 rounded-full whitespace-nowrap hover:border-primary transition';
            btn.innerText = text;
            btn.onclick = () => {
                if (text === 'Upload a drawing for clash check') {
                    document.getElementById('ai-file-input').click();
                    return;
                }
                document.getElementById('ai-input').value = text;
                this.submitAIChat();
            };
            container.appendChild(btn);
        });
    },

    submitAIChat() {
        const input = document.getElementById('ai-input');
        const text = input.value.trim();
        if (!text) return;

        // Add to history
        State.chatHistory.push({ role: 'user', text });
        input.value = '';

        // If not on copilot view, navigate there
        if (State.activeModule !== 'copilot') {
            this.navigateTo('copilot');
            // We need to wait for render to show loading
            setTimeout(() => this.showAILoadingAndRespond(text), 400);
        } else {
            // Update UI immediately
            const container = document.getElementById('chat-history-container');
            container.innerHTML += `
                        <div class="flex gap-4 max-w-3xl ml-auto flex-row-reverse mb-6">
                            <div class="w-8 h-8 rounded-full bg-textMain text-surface flex items-center justify-center flex-shrink-0">
                                <i data-lucide="user" class="w-4 h-4"></i>
                            </div>
                            <div class="space-y-1 text-right">
                                <div class="text-xs font-medium text-muted">You</div>
                                <div class="bg-textMain text-surface p-4 rounded-2xl rounded-tr-sm text-sm whitespace-pre-wrap">${text}</div>
                            </div>
                        </div>
                    `;
            lucide.createIcons();
            container.scrollTop = container.scrollHeight;
            this.showAILoadingAndRespond(text);
        }
    },

    async showAILoadingAndRespond(query, context = {}) {
        const container = document.getElementById('chat-history-container');
        if (!container) return;

        const loaderId = 'loader-' + Date.now();

        container.innerHTML += `
                    <div id="${loaderId}" class="flex gap-4 max-w-3xl mb-6">
                        <div class="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                            <i data-lucide="bot" class="w-4 h-4 text-primary"></i>
                        </div>
                        <div class="space-y-1">
                            <div class="text-xs font-medium text-muted">Copilot</div>
                            <div class="bg-surface border border-border p-4 rounded-2xl rounded-tl-sm h-12 flex items-center gap-1 w-24">
                                <div class="w-2 h-2 rounded-full bg-primary loader-dot"></div>
                                <div class="w-2 h-2 rounded-full bg-primary loader-dot"></div>
                                <div class="w-2 h-2 rounded-full bg-primary loader-dot"></div>
                            </div>
                        </div>
                    </div>
                `;
        lucide.createIcons();
        container.scrollTop = container.scrollHeight;

        let responseText = "";
        try {
            const res = await fetch(`${API_URL}/api/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: query,
                    active_module: State.activeModule
                })
            });
            const data = await res.json();
            responseText = data.response;
            await syncStateWithBackend();
        } catch (e) {
            console.error("Error communicating with AI backend:", e);
            responseText = "⚠️ **Error connecting to local AI engine.** Make sure uvicorn is running at http://localhost:8000.";
        }

        const loaderEl = document.getElementById(loaderId);
        if (loaderEl) loaderEl.remove();

        State.chatHistory.push({ role: 'bot', text: responseText });

        container.innerHTML += `
                    <div class="flex gap-4 max-w-3xl mb-6">
                        <div class="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0">
                            <i data-lucide="bot" class="w-4 h-4 text-primary"></i>
                        </div>
                        <div class="space-y-1">
                            <div class="text-xs font-medium text-muted">Copilot</div>
                            <div class="bg-surface border border-border text-textMain p-4 rounded-2xl rounded-tl-sm text-sm whitespace-pre-wrap leading-relaxed">${responseText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')}</div>
                        </div>
                    </div>
                `;
        lucide.createIcons();
        container.scrollTop = container.scrollHeight;
    },

    // --- CROSS MODULE SIMULATION ---
    async simulateEvent() {
        try {
            const type = Math.random() > 0.5 ? 'weather' : 'material';
            const response = await fetch(`${API_URL}/api/simulate-event`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type })
            });
            const data = await response.json();
            
            await syncStateWithBackend();

            // UI Feedback (Toast)
            const toast = document.createElement('div');
            toast.className = 'fixed top-6 left-1/2 -translate-x-1/2 bg-textMain text-surface px-6 py-3 rounded-lg shadow-float flex items-center gap-3 z-[200] transform -translate-y-12 opacity-0';
            toast.innerHTML = `<i data-lucide="zap" class="w-5 h-5 text-warning"></i> <span>Cross-Module Intelligence Synced via AI</span>`;
            document.body.appendChild(toast);
            lucide.createIcons();

            gsap.to(toast, { y: 0, opacity: 1, duration: 0.3, ease: 'back.out' });
            setTimeout(() => {
                gsap.to(toast, { y: -12, opacity: 0, duration: 0.3, onComplete: () => toast.remove() });
            }, 3000);

            // Re-render current view to show changes
            if (State.project) {
                this.navigateTo(State.activeModule);
            }
        } catch (e) {
            console.error("Error running AI event simulation:", e);
            alert("Failed to trigger simulation. Make sure backend is running.");
        }
    },

    // --- WIZARD LOGIC ---
    openWizard() {
        State.wizardCurrentStep = 0;
        this.renderWizard();
        const overlay = document.getElementById('wizard-overlay');
        overlay.classList.remove('hidden');
        setTimeout(() => {
            overlay.classList.remove('opacity-0');
            gsap.fromTo(overlay.querySelector('div'),
                { scale: 0.95, opacity: 0 },
                { scale: 1, opacity: 1, duration: 0.3, ease: 'power2.out' }
            );
        }, 10);
    },

    closeWizard() {
        const overlay = document.getElementById('wizard-overlay');
        overlay.classList.add('opacity-0');
        setTimeout(() => overlay.classList.add('hidden'), 300);
    },

    renderWizard() {
        // Render Steps Sidebar
        const stepsContainer = document.getElementById('wizard-steps');
        stepsContainer.innerHTML = WIZARD_STEPS.map((step, idx) => `
                    <div class="flex items-start gap-4 mb-6 opacity-${idx > State.wizardCurrentStep ? '50' : '100'} transition-opacity">
                        <div class="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-medium border-2 
                            ${idx === State.wizardCurrentStep ? 'border-primary bg-primary text-white' :
                idx < State.wizardCurrentStep ? 'border-success bg-success text-white' : 'border-border bg-surface text-muted'}">
                            ${idx < State.wizardCurrentStep ? '<i data-lucide="check" class="w-4 h-4"></i>' : idx + 1}
                        </div>
                        <div>
                            <div class="font-medium text-sm ${idx === State.wizardCurrentStep ? 'text-textMain' : 'text-muted'}">${step.title}</div>
                            <div class="text-xs text-muted mt-0.5">Step ${idx + 1} of ${WIZARD_STEPS.length}</div>
                        </div>
                    </div>
                `).join('');
        lucide.createIcons();

        // Render Form Area
        const formArea = document.getElementById('wizard-form-area');
        formArea.innerHTML = WIZARD_STEPS.map((step, idx) => `
                    <div class="step-content ${idx === State.wizardCurrentStep ? 'active' : ''}" id="step-${idx}">
                        <h3 class="text-xl font-bold mb-6">${step.title}</h3>
                        <div class="space-y-5">
                            ${step.fields.map(f => this.generateFormField(f)).join('')}
                        </div>
                    </div>
                `).join('');

        // Update Buttons
        const prevBtn = document.getElementById('wizard-prev');
        const nextBtn = document.getElementById('wizard-next');

        prevBtn.style.display = State.wizardCurrentStep === 0 ? 'none' : 'block';
        prevBtn.onclick = () => {
            State.wizardCurrentStep--;
            this.renderWizard();
        };

        if (State.wizardCurrentStep === WIZARD_STEPS.length - 1) {
            nextBtn.innerHTML = '<i data-lucide="cpu" class="w-4 h-4 inline mr-2"></i>Initialize AI Hub';
            nextBtn.classList.replace('bg-textMain', 'bg-primary');
            nextBtn.classList.replace('hover:bg-black', 'hover:bg-primaryHover');
            nextBtn.onclick = () => this.finishWizard();
        } else {
            nextBtn.innerHTML = 'Next Step';
            nextBtn.classList.replace('bg-primary', 'bg-textMain');
            nextBtn.classList.replace('hover:bg-primaryHover', 'hover:bg-black');
            nextBtn.onclick = () => {
                // Quick validation simulation
                if (State.wizardCurrentStep === 0 && !document.getElementById('projectName').value) {
                    document.getElementById('projectName').value = "Genesis Hyper-Scale Data Center"; // Auto-fill for demo
                }
                State.wizardCurrentStep++;
                this.renderWizard();
            };
        }
        lucide.createIcons();
    },

    generateFormField(field) {
        if (field.type === 'select') {
            return `
                        <div>
                            <label class="block text-sm font-medium text-textMain mb-1.5">${field.label}</label>
                            <select id="${field.id}" class="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary transition">
                                ${field.options.map(o => `<option value="${o}">${o}</option>`).join('')}
                            </select>
                        </div>
                    `;
        }
        if (field.type === 'toggle') {
            return `
                        <div class="flex items-center justify-between p-4 border border-border rounded-lg bg-surface/50">
                            <div>
                                <div class="font-medium text-sm text-textMain">${field.label}</div>
                                <div class="text-xs text-muted mt-0.5">${field.desc}</div>
                            </div>
                            <label class="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" value="" class="sr-only peer" ${field.checked ? 'checked' : ''}>
                                <div class="w-11 h-6 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                            </label>
                        </div>
                    `;
        }
        return `
                    <div>
                        <label class="block text-sm font-medium text-textMain mb-1.5">${field.label}</label>
                        <input type="${field.type}" id="${field.id}" placeholder="${field.placeholder || ''}" class="w-full bg-surface border border-border rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:border-primary transition">
                    </div>
                `;
    },

    async finishWizard() {
        // Gather data
        const nameInput = document.getElementById('projectName').value || "Genesis Hyper-Scale Data Center";
        const clientInput = document.getElementById('client')?.value || "Apex Corp";
        const locationInput = document.getElementById('location')?.value || "New York, USA";
        const typeInput = document.getElementById('projectType')?.value || "Commercial";
        const floorsInput = parseInt(document.getElementById('floors')?.value) || 12;
        const areaInput = parseFloat(document.getElementById('builtArea')?.value) || 15000;
        const structInput = document.getElementById('structuralSystem')?.value || "RC Frame";
        const startInput = document.getElementById('startDate')?.value || new Date().toISOString().split('T')[0];
        const endInput = document.getElementById('completionDate')?.value || new Date(Date.now() + 365*24*60*60*1000).toISOString().split('T')[0];
        const shiftInput = document.getElementById('shiftCount')?.value || "2 Shifts";

        const payload = {
            projectName: nameInput,
            client: clientInput,
            location: locationInput,
            projectType: typeInput,
            floors: floorsInput,
            builtArea: areaInput,
            structuralSystem: structInput,
            startDate: startInput,
            completionDate: endInput,
            shiftCount: shiftInput,
            aiRisk: true,
            aiWeather: true,
            aiDocs: true
        };

        // Loading State
        const formArea = document.getElementById('wizard-form-area');
        formArea.innerHTML = `
                    <div class="flex flex-col items-center justify-center h-full space-y-6">
                        <div class="w-16 h-16 border-4 border-surface border-t-primary rounded-full animate-spin"></div>
                        <div class="text-center">
                            <h3 class="text-lg font-semibold ai-gradient-text">Ingesting Project Data...</h3>
                            <p class="text-sm text-muted mt-1" id="loading-text">Constructing knowledge graph</p>
                        </div>
                    </div>
                `;

        let texts = ["Analyzing schematics", "Generating baseline schedules", "Initializing Copilot..."];
        let idx = 0;
        const int = setInterval(() => {
            const el = document.getElementById('loading-text');
            if (el) el.innerText = texts[idx++];
            if (idx >= texts.length) clearInterval(int);
        }, 800);

        try {
            await fetch(`${API_URL}/api/init-project`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            await syncStateWithBackend();
            document.getElementById('header-project-name').innerText = State.project.projectName;
        } catch (e) {
            console.error("Error initializing project with API:", e);
            State.project = payload;
            document.getElementById('header-project-name').innerText = State.project.projectName;
        }

        setTimeout(() => {
            this.closeWizard();

            // Hide welcome, show app layout
            document.getElementById('welcome-screen').style.display = 'none';
            const layout = document.getElementById('app-layout');
            layout.classList.remove('opacity-0', 'pointer-events-none');

            // Navigate to dashboard
            this.navigateTo('dashboard');
        }, 3000);
    }
};

// Initialize App on Load
document.addEventListener('DOMContentLoaded', () => {
    App.init();
});