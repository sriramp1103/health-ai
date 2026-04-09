let currentText = "";
let synth = window.speechSynthesis;
let isSpeaking = false;
let messageHistory = []; // Global history for follow-ups

// Image mappings intentionally removed

async function generate() {
    const condition = document.getElementById("condition").value;
    const literacy = document.getElementById("literacy").value;
    const age = document.getElementById("age").value;
    const language = document.getElementById("language").value;

    if (!condition.trim()) {
        alert("Please enter a health condition.");
        return;
    }

    const generateBtn = document.getElementById("generateBtn");
    const btnText = generateBtn.querySelector(".btn-text");
    const spinner = generateBtn.querySelector(".spinner");
    const resultsContainer = document.getElementById("results-container");
    const outputDiv = document.getElementById("output");

    // UI Loading State
    generateBtn.disabled = true;
    btnText.textContent = "Generating...";
    resultsContainer.classList.remove("hidden");
    
    // Inject Skeleton Loading Cards
    outputDiv.innerHTML = `
        <div class="skeleton-card"><div class="skeleton-title"></div><div class="skeleton-text"></div><div class="skeleton-text"></div><div class="skeleton-text"></div></div>
        <div class="skeleton-card"><div class="skeleton-title"></div><div class="skeleton-text"></div><div class="skeleton-text"></div><div class="skeleton-text"></div></div>
        <div class="skeleton-card"><div class="skeleton-title"></div><div class="skeleton-text"></div><div class="skeleton-text"></div><div class="skeleton-text"></div></div>
    `;
    
    // Hide Dashboards during fresh generation
    document.getElementById("risk-dashboard").classList.add("hidden");
    document.getElementById("chat-card").classList.add("hidden");
    document.getElementById("chat-history").innerHTML = "";
    messageHistory = []; 
    
    // Stop speaking if currently speaking
    if(isSpeaking) toggleSpeech();

    const isLearningMode = document.getElementById("learningMode").checked;

    let languageInstructions = `Your entire response MUST be translated into and written in ${language}.`;
    if (isLearningMode && language !== "English") {
        languageInstructions = `LEARNING MODE IS ON! You MUST output EVERY section displaying BOTH English AND ${language} stacked safely on top of each other.
Example format for each section:
English: [The explanation in English]
<br><br>
${language}: [The explanation translated into ${language}]`;
    }

    const prompt = `
You are a professional medical educator AI. 
Explain ${condition} specifically for a ${age} patient.
SMART SIMPLIFICATION RULES:
- If "${literacy}" is "Simple": Use very easy words, avoid medical jargon completely.
- If "${literacy}" is "Moderate": Use balanced wording.
- If "${literacy}" is "Advanced": Use detailed, academic clinical vocabulary.

${languageInstructions}

You MUST strictly follow this exact structure using exactly these markdown headings (translate the heading text into ${language} if necessary, but keep the ### markdown). 
Do NOT include any extra text.

### Understanding the Condition
(Provide a highly detailed explanation with bullet points and examples)

### Symptoms
(List the detailed symptoms using bullet points and examples)

### Treatment & Medications
(Explain common treatments, medications, usage guidance, and safety precautions)

### Diet Recommendations
(Provide very detailed dietary recommendations and examples of foods)

### Lifestyle Advice
(Provide lifestyle changes and real life examples)

### When to See a Doctor
(Explain clearly when it is critical to seek professional medical attention)
`;

    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer Your API KEY",
                "HTTP-Referer": "http://localhost",
                "X-Title": "Health AI App"
            },
            body: JSON.stringify({
                model: "openai/gpt-4o-mini",
                messages: [{ role: "user", content: prompt }]
            })
        });

        const data = await response.json();

        if (data.choices && data.choices.length > 0) {
            const text = data.choices[0].message.content;
            currentText = text; // Save for TTS
            
            const sections = text.split("###").filter(sec => sec.trim() !== "");
            let html = "";

            for (let [index, sec] of sections.entries()) {
                const lines = sec.trim().split("\n");
                let title = lines[0].trim();
                
                // Remove markdown bold from title if AI adds it
                title = title.replace(/\*\*/g, '');

                const contentMarkdown = lines.slice(1).join("\n");
                
                // Parse markdown content
                let parsedContent = "";
                if(typeof marked !== 'undefined') {
                    parsedContent = marked.parse(contentMarkdown);
                } else {
                    parsedContent = `<p>${contentMarkdown.replace(/\n\n/g, '</p><p>').replace(/\n/g, '<br>')}</p>`;
                }

                // Determine icon and theme
                let icon = "🧠";
                let theme = 'understanding';
                const titleLower = title.toLowerCase();

                if (titleLower.includes("diet") || titleLower.includes("food") || titleLower.includes("உணவு") || titleLower.includes("आहार")) {
                    icon = "🥗";
                    theme = 'diet';
                } else if (titleLower.includes("treatment") || titleLower.includes("medication") || titleLower.includes("சிகிச்சை") || titleLower.includes("उपचार") || titleLower.includes("drug") || titleLower.includes("மருந்து") || titleLower.includes("दवा")) {
                    icon = "💊";
                    theme = 'treatment';
                } else if (titleLower.includes("symptom") || titleLower.includes("அறிகுறிகள்") || titleLower.includes("लक्षण")) {
                    icon = "⚠️";
                    theme = 'symptom';
                } else if (titleLower.includes("lifestyle") || titleLower.includes("வாழ்க்கை") || titleLower.includes("जीवनशैली")) {
                    icon = "🏃";
                    theme = 'lifestyle';
                } else if (titleLower.includes("doctor") || titleLower.includes("மருத்துவர்") || titleLower.includes("डॉक्टर")) {
                    icon = "🩺";
                    theme = 'treatment';
                }

                html += `
                    <div class="section-card" style="animation: fadeInUp ${0.3 + (index * 0.1)}s ease-out">
                        <div class="section-content">
                            <h3 class="section-title">${icon} ${title}</h3>
                            <div class="section-text">${parsedContent}</div>
                        </div>
                    </div>
                `;
            }

            outputDiv.innerHTML = html;
            
            // Calculate and display risk dashboard
            const riskData = calculateRisk(condition, age);
            const riskDashboard = document.getElementById("risk-dashboard");
            const riskLabel = document.getElementById("risk-label");
            const riskMeter = document.getElementById("risk-meter-fill");
            const riskExpl = document.getElementById("risk-explanation");

            riskLabel.innerHTML = `${riskData.level} ${riskData.icon}`;
            riskLabel.className = `risk-badge ${riskData.classModifier}`;
            riskMeter.style.width = `${riskData.score}%`;
            riskMeter.className = riskData.classModifier.replace('risk', 'bg');
            riskExpl.textContent = riskData.explanation;
            riskDashboard.classList.remove("hidden");

            // Setup Chat History with Initial Content
            messageHistory = [
                { role: "system", content: "You are a helpful healthcare assistant. Answer the user's questions based on the medical context provided in their personalized guide. Keep it simple and student-friendly." },
                { role: "user", content: `I need information about ${condition}.` },
                { role: "assistant", content: text }
            ];
            document.getElementById("chat-card").classList.remove("hidden");
            
            resultsContainer.classList.remove("hidden");
        } else {
            outputDiv.innerHTML = "<p class='error'>No response from AI. Please try again.</p>";
            resultsContainer.classList.remove("hidden");
        }

    } catch (error) {
        console.error(error);
        outputDiv.innerHTML = "<p class='error'>Error generating response. Check your internet connection.</p>";
        resultsContainer.classList.remove("hidden");
    } finally {
        generateBtn.disabled = false;
        btnText.textContent = "Generate Guide";
        spinner.classList.add("hidden");
    }
}

// Text to Speech
function toggleSpeech() {
    const listenBtnText = document.getElementById("listenText");
    const language = document.getElementById("language").value;
    
    if (isSpeaking) {
        synth.cancel();
        isSpeaking = false;
        listenBtnText.textContent = "Listen";
        return;
    }

    if (!currentText) return;

    // Clean markdown symbols for speech
    const cleanText = currentText.replace(/[#*]/g, '');

    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    // Attempt to set matching voice language
    if(language === "Tamil") {
        utterance.lang = "ta-IN";
    } else if (language === "Hindi") {
        utterance.lang = "hi-IN";
    } else {
        utterance.lang = "en-US";
    }
    
    utterance.onend = () => {
        isSpeaking = false;
        listenBtnText.textContent = "Listen";
    };

    synth.speak(utterance);
    isSpeaking = true;
    listenBtnText.textContent = "Stop Listening";
}

// Stop speech when leaving page
window.addEventListener("beforeunload", () => {
    if(synth) synth.cancel();
});

// Voice Input Feature
function startDictation() {
    if (window.hasOwnProperty('webkitSpeechRecognition') || window.hasOwnProperty('SpeechRecognition')) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();

        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = "en-US";

        const micBtn = document.getElementById("micBtn");
        const condInput = document.getElementById("condition");

        recognition.onstart = function() {
            micBtn.classList.add("recording-pulse");
            condInput.placeholder = "Listening...";
        };

        recognition.onresult = function(e) {
            condInput.value = e.results[0][0].transcript;
            recognition.stop();
        };

        recognition.onerror = function(e) {
            recognition.stop();
        };

        recognition.onend = function() {
            micBtn.classList.remove("recording-pulse");
            condInput.placeholder = "e.g. Diabetes, Hypertension...";
        };

        recognition.start();
    } else {
        alert("Your browser does not support voice input. Please use Chrome.");
    }
}

// Follow-up Chat Logic
async function sendFollowUp() {
    const chatInput = document.getElementById("chatInput");
    const chatHistoryDiv = document.getElementById("chat-history");
    const sendBtn = document.getElementById("chatSendBtn");
    const query = chatInput.value.trim();

    if (!query) return;

    // 1. Add User Message to UI
    appendChatMessage("user", query);
    chatInput.value = "";

    // 2. Add History
    messageHistory.push({ role: "user", content: query });

    // 3. Show Typing
    const typingId = "typing-" + Date.now();
    const typingDiv = document.createElement("div");
    typingDiv.id = typingId;
    typingDiv.className = "chat-typing";
    typingDiv.textContent = "AI is thinking...";
    chatHistoryDiv.appendChild(typingDiv);
    chatHistoryDiv.scrollTop = chatHistoryDiv.scrollHeight;

    // 4. API Call
    try {
        sendBtn.disabled = true;
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": "Bearer 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",
                "HTTP-Referer": "http://localhost",
                "X-Title": "Health AI App"
            },
            body: JSON.stringify({
                model: "openai/gpt-4o-mini",
                messages: messageHistory,
                max_tokens: 500
            })
        });

        const data = await response.json();
        typingDiv.remove();

        if (data.choices && data.choices.length > 0) {
            const aiText = data.choices[0].message.content;
            appendChatMessage("ai", aiText);
            messageHistory.push({ role: "assistant", content: aiText });
        }
    } catch (e) {
        typingDiv.remove();
        appendChatMessage("ai", "Sorry, I encountered an issue. Please try again.");
    } finally {
        sendBtn.disabled = false;
    }
}

function appendChatMessage(role, text) {
    const chatHistoryDiv = document.getElementById("chat-history");
    const msgDiv = document.createElement("div");
    msgDiv.className = `chat-msg ${role === 'user' ? 'user-msg' : 'ai-msg'}`;
    
    // Small markdown-like parser for the chat too
    if (typeof marked !== 'undefined' && role === 'ai') {
        msgDiv.innerHTML = marked.parse(text);
    } else {
        msgDiv.textContent = text;
    }
    
    chatHistoryDiv.appendChild(msgDiv);
    chatHistoryDiv.scrollTop = chatHistoryDiv.scrollHeight;
}

// Risk Calculation Feature
function calculateRisk(condition, age) {
    const textLower = condition.toLowerCase();
    
    // Basic severity heuristics
    const highRiskKeywords = ["cancer", "heart", "stroke", "tumor", "infarct", "failure", "leukemia", "severe", "internal bleed"];
    const modRiskKeywords = ["diabetes", "asthma", "hypertension", "blood pressure", "syndrome", "fracture", "infection", "bronchitis"];
    
    let isHigh = highRiskKeywords.some(kw => textLower.includes(kw));
    let isMod = modRiskKeywords.some(kw => textLower.includes(kw));
    
    let level = "Low Risk";
    let icon = "🟢";
    let classModifier = "risk-low";
    let score = 25;
    let explanation = "Based on current indicators, this condition is generally manageable with standard care.";
    
    if (isHigh || (isMod && age === "Senior") || (age === "Senior" && textLower.includes("pain"))) {
        level = "High Risk"; 
        icon = "🔴"; 
        classModifier = "risk-high";
        score = 85;
        explanation = "Immediate professional consultation is advised due to clinical severity markers and patient age.";
    } else if (isMod || (age === "Senior") || (age === "Child" && textLower.includes("fever"))) {
        level = "Moderate Risk"; 
        icon = "🟡"; 
        classModifier = "risk-mod";
        score = 55;
        explanation = "Requires consistent monitoring and a structured treatment plan to avoid complications.";
    }

    return { level, icon, classModifier, score, explanation };
}

// Helper: Clean up text for PDF - strips emojis and symbols that cause encoding glitches
function sanitizePDFText(str) {
    if (!str) return "";
    // 1. Map common medical icons to plain text first
    const mapping = {
        "🧠": "UNDERSTANDING",
        "⚠️": "SYMPTOMS",
        "💊": "TREATMENT & MEDICATIONS",
        "🥗": "DIET RECOMMENDATIONS",
        "🏃": "LIFESTYLE ADVICE"
    };

    let cleanStr = str;
    for (const [icon, text] of Object.entries(mapping)) {
        cleanStr = cleanStr.replace(icon, text);
    }

    // 2. Remove all remaining emojis and non-standard Unicode symbols
    return cleanStr
        .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
        .replace(/[^\x00-\x7F]/g, "") // Strip any remaining non-ASCII characters (e.g. Ø>Ýà)
        .trim();
}

// PDF Download Feature - Symbol-Free Professional Version
function downloadPDF() {
    const dlBtn = document.querySelector(".download-btn");
    const originalText = dlBtn.innerHTML;

    try {
        const jsPDFConstructor = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
        if (!jsPDFConstructor) throw new Error("Library missing");

        const doc = new jsPDFConstructor('p', 'mm', 'a4');
        const MARGIN_X = 20;
        const PAGE_WIDTH = 210;
        const LIMIT_Y = 270;
        const CONTENT_WIDTH = 170; // PAGE_WIDTH - 2*MARGIN_X
        
        let y = 20; 

        const condition = document.getElementById("condition").value || "Health Guide";
        const age = document.getElementById("age").value || "Adult";
        const riskData = calculateRisk(condition, age);

        // Helper: Page management
        const handlePageBreak = (needed) => {
            if (y + needed > LIMIT_Y) {
                doc.addPage();
                y = 20;
                // Add header/footer to new page
                doc.setFontSize(8);
                doc.setTextColor(150);
                doc.text(`Page ${doc.internal.getNumberOfPages()} - ${condition}`, PAGE_WIDTH / 2, 290, { align: "center" });
            }
        };

        // UI Feedback
        dlBtn.innerHTML = "Cleaning...";
        dlBtn.disabled = true;

        // 1. Report Title
        doc.setFont("helvetica", "bold");
        doc.setFontSize(26);
        doc.setTextColor(40);
        doc.text("MEDICAL HEALTH REPORT", MARGIN_X, y);
        y += 15;

        // 2. Patient Details Brief
        doc.setFontSize(14);
        doc.text(`CONDITION: ${sanitizePDFText(condition).toUpperCase()}`, MARGIN_X, y);
        y += 8;

        doc.setFontSize(12);
        doc.setTextColor(riskData.score > 70 ? 200 : riskData.score > 40 ? 120 : 60, 0, 0);
        doc.text(`RISK LEVEL: ${riskData.level}`, MARGIN_X, y);
        y += 10;

        doc.setFont("helvetica", "normal");
        doc.setTextColor(100);
        doc.setFontSize(11);
        const explText = sanitizePDFText(riskData.explanation);
        const explLines = doc.splitTextToSize(explText, CONTENT_WIDTH);
        doc.text(explLines, MARGIN_X, y);
        y += (explLines.length * 6) + 15;

        // 3. Render Each Section
        const sections = document.querySelectorAll('.section-card');
        sections.forEach((card) => {
            const titleEl = card.querySelector('.section-title');
            const textEl = card.querySelector('.section-text');
            if (!titleEl || !textEl) return;

            const cleanTitle = sanitizePDFText(titleEl.textContent);
            const cleanContent = sanitizePDFText(textEl.textContent);

            // Heading Block
            handlePageBreak(30);
            doc.setFont("helvetica", "bold");
            doc.setFontSize(18);
            doc.setTextColor(20, 60, 150); // Deep blue
            doc.text(cleanTitle, MARGIN_X, y);
            
            doc.setLineWidth(0.8);
            doc.line(MARGIN_X, y + 2, MARGIN_X + 50, y + 2);
            y += 12; // Gap between heading and text

            // Content Block
            doc.setFont("helvetica", "normal");
            doc.setFontSize(12);
            doc.setTextColor(40);

            const paragraphs = cleanContent.split('\n\n');
            paragraphs.forEach(para => {
                const pText = para.trim();
                if (!pText) return;

                const lines = doc.splitTextToSize(pText, CONTENT_WIDTH);
                const blockH = lines.length * 6;
                
                handlePageBreak(blockH + 5);
                doc.text(lines, MARGIN_X, y);
                y += blockH + 8; // Paragraph spacing
            });

            y += 5; // Section spacing
        });

        // 4. Save
        doc.save(`Medical_Report_${condition.replace(/[^a-z0-9]/gi, '_')}.pdf`);

    } catch (e) {
        console.error(e);
        alert("Download error. Please generate the guide first.");
    } finally {
        setTimeout(() => {
            dlBtn.innerHTML = originalText;
            dlBtn.disabled = false;
        }, 800);
    }
}
