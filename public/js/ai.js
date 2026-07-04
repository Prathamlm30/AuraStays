document.addEventListener("DOMContentLoaded", () => {
    
    // ==========================================
    // 1. AI LISTING INSIGHTS LOGIC (Guest View)
    // ==========================================
    const aiContainer = document.getElementById("ai-container");
    const aiBtn = document.getElementById("ai-btn");
    const aiOutput = document.getElementById("ai-output");
    const aiLoader = document.getElementById("ai-loader");
    const aiText = document.getElementById("ai-text");

    let isInsightsGenerated = false;
    let isInsightsVisible = false;

    if (aiBtn && aiContainer) {
        aiBtn.addEventListener("click", async () => {
            if (!isInsightsGenerated) {
                const listingId = aiContainer.getAttribute("data-id");

                aiBtn.disabled = true;
                aiBtn.innerText = "Generating...";
                aiOutput.style.display = "block";
                aiLoader.style.display = "block";
                aiText.innerHTML = "";

                try {
                    const response = await fetch(`/listings/${listingId}/ai-summary`);
                    const data = await response.json();

                    aiLoader.style.display = "none";
                    
                    if (data.error) {
                        aiText.innerHTML = `<span class="text-danger">Could not load insights at this time.</span>`;
                        aiBtn.innerText = "Generate Insights";
                    } else {
                        const formattedText = data.summary.split('\n').map(line => `<p class="mb-2">${line}</p>`).join('');
                        aiText.innerHTML = formattedText;
                        
                        isInsightsGenerated = true;
                        isInsightsVisible = true;
                        aiBtn.innerText = "Hide Insights";
                        // REMOVED class swapping line here to maintain solid styling
                    }
                } catch (err) {
                    aiLoader.style.display = "none";
                    aiText.innerHTML = `<span class="text-danger">Something went wrong.</span>`;
                    aiBtn.innerText = "Generate Insights"; 
                } finally {
                    aiBtn.disabled = false;
                }
            } else {
                if (isInsightsVisible) {
                    aiOutput.style.display = "none";
                    aiBtn.innerText = "Show Insights";
                    isInsightsVisible = false;
                } else {
                    aiOutput.style.display = "block";
                    aiBtn.innerText = "Hide Insights";
                    isInsightsVisible = true;
                }
            }
        });
    }

    // ==========================================
    // 2. AI TRIP PLANNER LOGIC (Consumer View)
    // ==========================================
    const itineraryBtn = document.getElementById("itinerary-btn");
    const itineraryOutput = document.getElementById("itinerary-output");
    const itineraryLoader = document.getElementById("itinerary-loader");
    const itineraryText = document.getElementById("itinerary-text");

    let isItineraryGenerated = false;
    let isItineraryVisible = false;

    if (itineraryBtn && aiContainer) {
        itineraryBtn.addEventListener("click", async () => {
            if (!isItineraryGenerated) {
                const listingId = aiContainer.getAttribute("data-id");

                itineraryBtn.disabled = true;
                itineraryBtn.innerText = "Planning...";
                itineraryOutput.style.display = "block";
                itineraryLoader.style.display = "block";
                itineraryText.innerHTML = "";

                try {
                    const response = await fetch(`/listings/${listingId}/ai-itinerary`);
                    const data = await response.json();

                    itineraryLoader.style.display = "none";
                    
                    if (data.error) {
                        itineraryText.innerHTML = `<span class="text-danger">Could not load the itinerary. Please try again later.</span>`;
                        itineraryBtn.innerText = "Plan My Trip"; 
                    } else {
                        itineraryText.innerHTML = data.itinerary;
                        
                        isItineraryGenerated = true;
                        isItineraryVisible = true;
                        itineraryBtn.innerText = "Hide Itinerary";
                        // REMOVED class swapping line here to maintain solid styling
                    }
                } catch (err) {
                    itineraryLoader.style.display = "none";
                    itineraryText.innerHTML = `<span class="text-danger">A network error occurred.</span>`;
                    itineraryBtn.innerText = "Plan My Trip"; 
                } finally {
                    itineraryBtn.disabled = false;
                }
            } else {
                if (isItineraryVisible) {
                    itineraryOutput.style.display = "none";
                    itineraryBtn.innerText = "Show Itinerary";
                    isItineraryVisible = false;
                } else {
                    itineraryOutput.style.display = "block";
                    itineraryBtn.innerText = "Hide Itinerary";
                    isItineraryVisible = true;
                }
            }
        });
    }

    // ==========================================
    // 3. HOST AI AUTO-RESPONDER LOGIC (Host View)
    // ==========================================
    const replyBtns = document.querySelectorAll(".ai-reply-btn");

    // Only run this if there are actually reply buttons on the page (meaning the host is viewing it)
    if (replyBtns.length > 0 && aiContainer) {
        // Extract the listing ID once for all buttons
        const listingId = aiContainer.getAttribute("data-id");

        replyBtns.forEach(btn => {
            btn.addEventListener("click", async () => {
                const reviewId = btn.getAttribute("data-review-id");
                
                // Locate specific UI targets for this specific review
                const replyBox = document.getElementById(`reply-box-${reviewId}`);
                const loader = document.getElementById(`loader-${reviewId}`);
                const textArea = document.getElementById(`reply-text-${reviewId}`);

                // Update UI element states
                btn.style.display = "none";
                replyBox.style.display = "block";
                loader.style.display = "inline-block";
                textArea.value = "";

                try {
                    // Fetch from your secured backend route
                    const response = await fetch(`/listings/${listingId}/reviews/${reviewId}/ai-reply`);
                    const data = await response.json();

                    loader.style.display = "none";
                    
                    if (data.error) {
                        textArea.value = data.error;
                    } else {
                        // Insert the AI's text into the textarea so the host can edit it
                        textArea.value = data.reply.trim();
                    }
                } catch (err) {
                    loader.style.display = "none";
                    textArea.value = "A network exception occurred while drafting the reply.";
                }
            });
        });
    }
});