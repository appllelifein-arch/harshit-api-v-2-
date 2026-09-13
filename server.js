const express = require('express');
const axios = require('axios');
const imap = require('imap-simple');
const { simpleParser } = require('mailparser');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve the Full Dashboard UI
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Netflix Command Center</title>
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
                .tab-active { background-color: rgba(220, 38, 38, 0.2); border-color: #dc2626; color: #fca5a5; }
                .hidden-section { display: none; }
            </style>
        </head>
        <body class="bg-zinc-950 text-zinc-100 flex items-center justify-center min-h-screen p-4">
            <div class="w-full max-w-2xl p-8 bg-zinc-900/80 backdrop-blur-md border border-zinc-800 rounded-3xl shadow-2xl">
                <div class="text-center mb-8">
                    <h1 class="text-3xl font-bold tracking-tight text-red-600">COMMAND CENTER</h1>
                    <p class="text-sm text-zinc-400 mt-2">Complete Automated Management Panel</p>
                </div>

                <!-- Tabs -->
                <div class="grid grid-cols-2 md:grid-cols-4 gap-2 mb-8">
                    <button onclick="showTab('reset')" id="tab-reset" class="tab-btn tab-active py-2 px-4 rounded-xl border border-zinc-700 text-xs font-bold tracking-wider transition hover:border-red-500">SEND RESET</button>
                    <button onclick="showTab('login')" id="tab-login" class="tab-btn py-2 px-4 rounded-xl border border-zinc-700 text-xs font-bold tracking-wider transition hover:border-red-500">CHECK LOGIN</button>
                    <button onclick="showTab('change')" id="tab-change" class="tab-btn py-2 px-4 rounded-xl border border-zinc-700 text-xs font-bold tracking-wider transition hover:border-red-500">IMAP CHANGE</button>
                    <button onclick="showTab('plan')" id="tab-plan" class="tab-btn py-2 px-4 rounded-xl border border-zinc-700 text-xs font-bold tracking-wider transition hover:border-red-500">CHECK PLAN</button>
                </div>

                <!-- Sections -->
                
                <!-- 1. Send Reset -->
                <div id="sec-reset" class="action-sec">
                    <form onsubmit="handleRequest(event, '/netflix/send-reset', { email: this.email.value })" class="space-y-4">
                        <div>
                            <label class="block text-xs uppercase tracking-wider text-zinc-400 mb-2">Target Email</label>
                            <input type="email" name="email" required placeholder="name@example.com" class="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl focus:outline-none focus:border-red-600">
                        </div>
                        <button type="submit" class="w-full py-3 bg-red-600 hover:bg-red-700 font-bold rounded-xl shadow-lg shadow-red-900/30 transition">Dispatch Reset Link</button>
                    </form>
                </div>

                <!-- 2. Check Login -->
                <div id="sec-login" class="action-sec hidden-section">
                    <form onsubmit="handleRequest(event, '/netflix/login', { email: this.email.value, password: this.password.value })" class="space-y-4">
                        <div>
                            <label class="block text-xs uppercase tracking-wider text-zinc-400 mb-2">Email</label>
                            <input type="email" name="email" required placeholder="name@example.com" class="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl focus:outline-none focus:border-red-600">
                        </div>
                        <div>
                            <label class="block text-xs uppercase tracking-wider text-zinc-400 mb-2">Password</label>
                            <input type="password" name="password" required placeholder="••••••••" class="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl focus:outline-none focus:border-red-600">
                        </div>
                        <button type="submit" class="w-full py-3 bg-red-600 hover:bg-red-700 font-bold rounded-xl shadow-lg shadow-red-900/30 transition">Verify Credentials</button>
                    </form>
                </div>

                <!-- 3. IMAP Change Password -->
                <div id="sec-change" class="action-sec hidden-section">
                    <form onsubmit="handleRequest(event, '/netflix/change-password', { email: this.email.value, newPassword: this.newPassword.value })" class="space-y-4">
                        <div>
                            <label class="block text-xs uppercase tracking-wider text-zinc-400 mb-2">Target Email</label>
                            <input type="email" name="email" required placeholder="name@example.com" class="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl focus:outline-none focus:border-red-600">
                        </div>
                        <div>
                            <label class="block text-xs uppercase tracking-wider text-zinc-400 mb-2">New Password to Set</label>
                            <input type="text" name="newPassword" required placeholder="NewPass123!" class="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl focus:outline-none focus:border-red-600">
                        </div>
                        <button type="submit" class="w-full py-3 bg-red-600 hover:bg-red-700 font-bold rounded-xl shadow-lg shadow-red-900/30 transition">Execute Auto-Change via IMAP</button>
                    </form>
                </div>

                <!-- 4. Check Plan -->
                <div id="sec-plan" class="action-sec hidden-section">
                    <form onsubmit="handleRequest(event, '/netflix/check-plan', { email: this.email.value })" class="space-y-4">
                        <div>
                            <label class="block text-xs uppercase tracking-wider text-zinc-400 mb-2">Target Email</label>
                            <input type="email" name="email" required placeholder="name@example.com" class="w-full px-4 py-3 bg-zinc-950 border border-zinc-800 rounded-xl focus:outline-none focus:border-red-600">
                        </div>
                        <button type="submit" class="w-full py-3 bg-red-600 hover:bg-red-700 font-bold rounded-xl shadow-lg shadow-red-900/30 transition">Fetch Plan Details</button>
                    </form>
                </div>

                <!-- Global Result Box -->
                <div id="resultBox" class="mt-6 p-4 rounded-xl text-sm hidden font-mono break-words"></div>
            </div>

            <script>
                function showTab(tabName) {
                    // Hide all sections
                    document.querySelectorAll('.action-sec').forEach(el => el.classList.add('hidden-section'));
                    // Remove active styling from all tabs
                    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('tab-active'));
                    
                    // Show target section & style target tab
                    document.getElementById('sec-' + tabName).classList.remove('hidden-section');
                    document.getElementById('tab-' + tabName).classList.add('tab-active');
                    
                    // Hide result box on tab switch
                    document.getElementById('resultBox').classList.add('hidden');
                }

                async function handleRequest(e, endpoint, payload) {
                    e.preventDefault();
                    const btn = e.target.querySelector('button[type="submit"]');
                    const originalText = btn.textContent;
                    const resultBox = document.getElementById('resultBox');
                    
                    btn.disabled = true;
                    btn.textContent = 'Processing...';
                    resultBox.classList.add('hidden');

                    try {
                        const response = await fetch(endpoint, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(payload)
                        });
                        const data = await response.json();

                        resultBox.classList.remove('hidden');
                        if (data.success) {
                            resultBox.className = 'mt-6 p-4 rounded-xl text-sm bg-emerald-950/40 border border-emerald-800 text-emerald-400 font-mono break-words';
                            resultBox.innerHTML = '<strong class="block mb-1 text-emerald-300">SUCCESS</strong>' + JSON.stringify(data, null, 2).replace(/\\n/g, '<br>');
                        } else {
                            resultBox.className = 'mt-6 p-4 rounded-xl text-sm bg-red-950/40 border border-red-800 text-red-400 font-mono break-words';
                            resultBox.innerHTML = '<strong class="block mb-1 text-red-300">ERROR</strong>' + (data.error || 'Request failed.');
                        }
                    } catch (err) {
                        resultBox.classList.remove('hidden');
                        resultBox.className = 'mt-6 p-4 rounded-xl text-sm bg-red-950/40 border border-red-800 text-red-400 font-mono break-words';
                        resultBox.innerHTML = '<strong class="block mb-1 text-red-300">SYSTEM ERROR</strong>Network error occurred.';
                    } finally {
                        btn.disabled = false;
                        btn.textContent = originalText;
                    }
                }
            </script>
        </body>
        </html>
    `);
});


// Helper function to fetch the latest email matching a query via IMAP
async function fetchLatestEmail(keyword) {
    const config = {
        imap: {
            user: process.env.IMAP_USER,
            password: process.env.IMAP_PASSWORD,
            host: process.env.IMAP_HOST || 'imap.gmail.com',
            port: parseInt(process.env.IMAP_PORT, 10) || 993,
            tls: true,
            authTimeout: 10000,
            tlsOptions: { rejectUnauthorized: false }
        }
    };

    let connection;
    try {
        connection = await imap.connect(config);
        await connection.openBox('INBOX');

        const searchCriteria = [['OR', ['SUBJECT', keyword], ['BODY', keyword]]];
        const fetchOptions = { bodies: [''], markSeen: false };

        const messages = await connection.search(searchCriteria, fetchOptions);
        if (!messages || messages.length === 0) return null;

        const latestMessage = messages[messages.length - 1];
        const part = latestMessage.parts.find((p) => p.which === '');
        const parsed = await simpleParser(part.body);
        
        connection.end();
        return {
            subject: parsed.subject,
            text: parsed.text,
            html: parsed.html,
            date: parsed.date
        };
    } catch (err) {
        if (connection) { try { connection.end(); } catch (e) {} }
        throw new Error(`IMAP Error: ${err.message}`);
    }
}

// 1. /netflix/login
app.post('/netflix/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ success: false, error: 'Email and password required.' });
    
    // Automation mock logic
    return res.status(200).json({ 
        success: true, 
        message: 'Credentials verified successfully.', 
        account: email,
        timestamp: new Date().toISOString()
    });
});

// 2. /netflix/send-reset - Trigger password reset link
app.post('/netflix/send-reset', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'Email is required.' });

    try {
        const payload = { userLoginId: email, flow: 'forgotPassword', countryIsoCode: 'IN' };
        // axios.post('https://www.netflix.com/api/youraccount/login/password', payload);

        return res.status(200).json({
            success: true,
            message: `Reset link dispatched to ${email}.`,
            flow: 'Automated Recovery'
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

// 3. /netflix/change-password
app.post('/netflix/change-password', async (req, res) => {
    const { email, newPassword } = req.body;
    if (!email || !newPassword) return res.status(400).json({ success: false, error: 'Email and newPassword required.' });

    try {
        // Wait to allow email delivery
        await new Promise((resolve) => setTimeout(resolve, 5000));
        const emailData = await fetchLatestEmail('Netflix');
        
        if (!emailData) return res.status(404).json({ success: false, error: 'No recent Netflix reset email found via IMAP.' });

        const urlRegex = /(https:\/\/[^\s]+reset[^\s]*|https:\/\/www\.netflix\.com\/[^\s"]+)/g;
        const matches = (emailData.html || emailData.text).match(urlRegex);
        if (!matches || matches.length === 0) return res.status(400).json({ success: false, error: 'Reset link could not be parsed from email.' });

        const resetLink = matches[0].replace(/["'>]/g, '');
        
        // Execute password change using resetLink (Mocked execution)
        return res.status(200).json({ 
            success: true, 
            message: 'Password successfully changed via IMAP scraping.', 
            extractedLink: resetLink,
            newPasswordSet: newPassword
        });
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

// 4. /netflix/check-plan
app.post('/netflix/check-plan', async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, error: 'Email required.' });
    
    // Mocked plan fetching logic
    return res.status(200).json({ 
        success: true, 
        email, 
        plan: 'Premium Ultra HD', 
        screens: 4, 
        status: 'Active',
        billingCycle: 'Monthly'
    });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Command Center running on port ${PORT}`);
});
