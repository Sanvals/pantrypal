document.addEventListener('DOMContentLoaded', function () {
    const categoryContainer = document.getElementById('category-container');
    const hiddenCategoryInput = document.getElementById('selected-category');
    const descriptionInput = document.getElementById('description');
    const kcalInput = document.getElementById('kcal');
    const sendBtn = document.getElementById('send-btn');
    const messageArea = document.getElementById('message-area');

    const sendBtnContent = document.getElementById('send-btn-content');
    const sendBtnLoadingText = document.getElementById('send-btn-loading-text');

    const notionItemsDisplay = document.getElementById('notion-items-display');

    const kcalProgressBarContainer = document.getElementById('kcal-progress-bar-container');
    const kcalProgressFill = document.getElementById('kcal-progress-fill');
    const kcalProgressText = document.getElementById('kcal-progress-text');
    const KCAL_CAP = 1500;

    const tabCategoryBtn = document.getElementById('tab-category');
    const tabTodayBtn = document.getElementById('tab-today');
    const tabHistoryBtn = document.getElementById('tab-history');
    const sectionCategory = document.getElementById('section-category');
    const sectionToday = document.getElementById('section-today');
    const sectionHistory = document.getElementById('section-history');
    const historyItemsDisplay = document.getElementById('history-items-display');

    // --- NOTION API ENDPOINT CONFIGURATION ---
    const NOTION_BACKEND_URL =
        window.location.hostname === 'localhost' ?
        '/api/pantryapi' :
        'https://pantrypal-gilt.vercel.app/api/pantryapi';

    console.log("Current hostname:", window.location.hostname);

    const kcalPlaceholders = {
        "Coffee": "50",
        "Breakfast": "311",
        "Lunch": "800",
        "Collagen": "40",
        "Exercise": "300"
    };

    const descriptionPlaceholders = {
        "Breakfast": [
            "Avocado toast with egg",
            "Oatmeal with berries",
            "Scrambled eggs and bacon",
            "Yogurt parfait",
            "Pancakes with syrup",
            "Smoothie bowl",
            "Fruit and muesli"
        ],
        "Collagen": [
            "Collagen in water",
            "Collagen in coffee",
            "Collagen smoothie",
            "Collagen with juice",
            "Collagen mixed into yogurt"
        ],
        "Coffee": [
            "Black coffee",
            "Latte with oat milk",
            "Espresso shot",
            "Cappuccino",
            "Iced Americano",
            "Flat white",
            "Mocha"
        ],
        "Lunch": [
            "Chicken salad",
            "Pasta with pesto",
            "Vegetable stir-fry",
            "Sandwich with turkey",
            "Sushi rolls",
            "Quinoa salad",
            "Lentil soup"
        ],
        "Exercise": [
            "30 min run",
            "Weightlifting session (legs)",
            "Yoga flow (60 min)",
            "Cycling (1 hour)",
            "Swimming laps (30 min)",
            "HIIT workout",
            "Boxing training"
        ],
        "Other": [
            "Snack (e.g., Apple)",
            "Dessert (e.g., Chocolate)",
            "Random drink (e.g., Soda)",
            "Supplement intake (e.g., Vitamin D)",
            "Midnight snack",
            "Something sweet"
        ]
    };

    function getRandomItem(arr) {
        if (!arr || arr.length === 0) return "";
        const randomIndex = Math.floor(Math.random() * arr.length);
        return arr[randomIndex];
    }

    function updateDescriptionPlaceholder(category) {
        const randomText = getRandomItem(descriptionPlaceholders[category] || descriptionPlaceholders["Other"]);
        descriptionInput.placeholder = `Description (e.g., ${randomText})`;
    }

    const tabBaseClasses = ['flex-1', 'py-2', 'px-3', 'text-center', 'text-base', 'font-bold', 'rounded-t-xl', 'cursor-pointer', 'transition-colors', 'duration-200'];
    const tabDefaultClasses = ['bg-gray-200', 'text-gray-700', 'hover:bg-gray-300'];
    const tabActiveClass = ['bg-indigo-500', 'text-white', 'shadow-md'];

    function setTabActiveState(button, isActive) {
        button.classList.remove(...tabDefaultClasses, ...tabActiveClass);
        if (isActive) {
            button.classList.add(...tabActiveClass);
        } else {
            button.classList.add(...tabDefaultClasses);
        }
    }

    let cachedNotionItems = null;
    let lastNotionFetchTime = 0;
    const NOTION_CACHE_DURATION = 5 * 60 * 1000; // Cache for 5 minutes (adjust as needed)

    let cachedHistoryData = null;
    let lastHistoryFetchTime = 0;
    const HISTORY_CACHE_DURATION = 15 * 60 * 1000; // Cache for 15 minutes, can be longer as it's less dynamic

    function showTab(tabName) {
        setTabActiveState(tabCategoryBtn, false);
        setTabActiveState(tabTodayBtn, false);
        setTabActiveState(tabHistoryBtn, false);

        sectionCategory.classList.add('hidden');
        sectionToday.classList.add('hidden');
        sectionHistory.classList.add('hidden');

        if (tabName === 'category') {
            setTabActiveState(tabCategoryBtn, true);
            sectionCategory.classList.remove('hidden');
        } else if (tabName === 'today') {
            setTabActiveState(tabTodayBtn, true);
            sectionToday.classList.remove('hidden');
            displayNotionItemsFromCacheOrFetch();
        } else if (tabName === 'history') {
            setTabActiveState(tabHistoryBtn, true);
            sectionHistory.classList.remove('hidden');
            fetchAndDisplayHistoryData();
        }
    }

    const categorySelectedClasses = [
        'border-indigo-500',
        'bg-gradient-to-br', 'from-indigo-300', 'to-indigo-400',
        'text-white',
        'scale-105',
        'shadow-lg',
        'category-selected-glow',
        'category-selected-checkmark'
    ];
    const categoryDefaultImgClasses = ['transition-transform', 'duration-600', 'ease-in'];

    categoryContainer.addEventListener('click', function(e) {
        const clickedButton = e.target.closest('button');
        if (!clickedButton || !clickedButton.dataset.category) return;

        const allButtons = categoryContainer.querySelectorAll('button');
        allButtons.forEach(btn => {
            btn.classList.remove(...categorySelectedClasses);
            const categoryData = btn.dataset.category;
            const defaultColorClasses = {
                "Breakfast": "border-sky-200 bg-sky-100 text-sky-800 hover:border-sky-400",
                "Collagen": "border-violet-200 bg-violet-100 text-violet-800 hover:border-violet-400",
                "Coffee": "border-amber-200 bg-amber-100 text-amber-800 hover:border-amber-400",
                "Lunch": "border-lime-200 bg-lime-100 text-lime-800 hover:border-lime-400",
                "Exercise": "border-teal-200 bg-teal-100 text-teal-800 hover:border-teal-400",
                "Other": "border-slate-200 bg-slate-100 text-slate-800 hover:border-slate-400",
            };
            btn.className = `relative border-2 rounded-xl p-2 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 ease-in-out ${defaultColorClasses[categoryData]}`;

            const img = btn.querySelector('img');
            if (img) {
                img.classList.remove('scale-125', 'ease-out');
                img.classList.add('ease-in');
            }
        });

        clickedButton.classList.add(...categorySelectedClasses);
        const clickedImg = clickedButton.querySelector('img');
        if (clickedImg) {
            clickedImg.classList.add('scale-125', 'ease-out');
            clickedImg.classList.remove('ease-in');
        }

        const selectedCategory = clickedButton.dataset.category;
        hiddenCategoryInput.value = selectedCategory;

        if (kcalPlaceholders[selectedCategory]) {
            const placeholderValue = (selectedCategory === "Exercise") ? -Math.abs(parseInt(kcalPlaceholders[selectedCategory] || 0)) : kcalPlaceholders[selectedCategory];
            kcalInput.placeholder = `kcal (e.g., ${placeholderValue})`;
        } else {
            kcalInput.placeholder = "kcal (e.g., 350)";
        }

        if (selectedCategory === "Exercise" && kcalInput.value !== "") {
            kcalInput.value = -Math.abs(parseInt(kcalInput.value || 0));
        } else if (selectedCategory !== "Exercise" && kcalInput.value !== "" && parseInt(kcalInput.value) < 0) {
            kcalInput.value = Math.abs(parseInt(kcalInput.value));
        }

        updateDescriptionPlaceholder(selectedCategory);
        descriptionInput.focus();
    });

    kcalInput.addEventListener('input', function() {
        const selectedCategory = hiddenCategoryInput.value;
        if (selectedCategory === "Exercise" && parseInt(this.value) > 0) {
            this.value = -Math.abs(parseInt(this.value));
        } else if (selectedCategory !== "Exercise" && parseInt(this.value) < 0) {
            this.value = Math.abs(parseInt(this.value));
        }
    });

    descriptionInput.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            sendBtn.click();
        }
    });
    kcalInput.addEventListener('keydown', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault();
            sendBtn.click();
        }
    });

    async function sendToNotion(data) {
        messageArea.textContent = '';
        sendBtn.disabled = true;
        sendBtnContent.classList.add('hidden');
        sendBtnLoadingText.classList.remove('hidden');

        sendBtn.classList.remove('bg-rose-500', 'text-white', 'hover:bg-rose-600', 'active:bg-rose-700', 'shadow-md');
        sendBtn.classList.add('bg-gray-400', 'text-gray-600', 'send-button-pulse', 'cursor-not-allowed');

        try {
            const response = await fetch(NOTION_BACKEND_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Backend (POST) error:', errorData);
                throw new Error(`Error: ${errorData.message || errorData.error || 'Unknown backend error'}`);
            }

            const result = await response.json();
            console.log('Successfully sent to Notion via backend:', result);

            hiddenCategoryInput.value = '';
            descriptionInput.value = '';
            kcalInput.value = '';
            kcalInput.placeholder = "kcal (e.g., 350)";

            const allButtons = categoryContainer.querySelectorAll('button');
            allButtons.forEach(btn => {
                btn.classList.remove(...categorySelectedClasses);
                const categoryData = btn.dataset.category;
                const defaultColorClasses = {
                    "Breakfast": "border-sky-200 bg-sky-100 text-sky-800 hover:border-sky-400",
                    "Collagen": "border-violet-200 bg-violet-100 text-violet-800 hover:border-violet-400",
                    "Coffee": "border-amber-200 bg-amber-100 text-amber-800 hover:border-amber-400",
                    "Lunch": "border-lime-200 bg-lime-100 text-lime-800 hover:border-lime-400",
                    "Exercise": "border-teal-200 bg-teal-100 text-teal-800 hover:border-teal-400",
                    "Other": "border-slate-200 bg-slate-100 text-slate-800 hover:border-slate-400",
                };
                btn.className = `relative border-2 rounded-xl p-2 flex flex-col items-center justify-center cursor-pointer transition-all duration-200 ease-in-out ${defaultColorClasses[categoryData]}`;
                const img = btn.querySelector('img');
                if (img) {
                    img.classList.remove('scale-125', 'ease-out');
                    img.classList.add('ease-in');
                }
            });

            if (navigator.vibrate) {
                navigator.vibrate(50);
            }

            cachedNotionItems = null; // Mark cache as stale for 'Today' tab
            lastNotionFetchTime = 0; // Reset fetch time
            cachedHistoryData = null; // Mark cache as stale for 'History' tab
            lastHistoryFetchTime = 0; // Reset fetch time
            displayNotionItemsFromCacheOrFetch(true); // Force a re-fetch to update the progress bar and 'Today' tab content
        } catch (error) {
            console.error('Failed to send to Notion:', error);
            messageArea.textContent = `Error: ${error.message || 'Network error'}`;
            messageArea.style.color = '#dc2626';
        } finally {
            setTimeout(() => {
                messageArea.textContent = '';
                sendBtn.disabled = false;
                sendBtnContent.classList.remove('hidden');
                sendBtnLoadingText.classList.add('hidden');
                sendBtn.classList.remove('bg-gray-400', 'text-gray-600', 'send-button-pulse', 'cursor-not-allowed');
                sendBtn.classList.add('bg-rose-500', 'text-white', 'hover:bg-rose-600', 'active:bg-rose-700', 'shadow-md');
            }, 2000);
        }
    }

    function getSkeletonLoaderHtml(count = 3) {
        let html = '';
        for (let i = 0; i < count; i++) {
            html += `
                <div class="h-6 bg-gray-200 rounded w-full mb-2 animate-pulse-bg"></div>
            `;
        }
        return html;
    }

    let lastPercentage = 0;
    function updateKcalProgressBar(currentKcalSum) {
        const newPercentage = Math.min(100, (currentKcalSum / KCAL_CAP) * 100);

        kcalProgressFill.style.width = `${newPercentage}%`;

        const progressIcon = document.getElementById('progress-icon');
        if (progressIcon) {
            progressIcon.style.left = `${newPercentage}%`;
            progressIcon.classList.remove('icon-animate-bounce');
            void progressIcon.offsetWidth; // Trigger reflow
            progressIcon.classList.add('icon-animate-bounce');
        }

        let emoji = '';
        const remaining = KCAL_CAP - currentKcalSum;

        if (currentKcalSum <= KCAL_CAP) {
            emoji = '✨ ';
            kcalProgressText.textContent = `${emoji}${currentKcalSum} / ${KCAL_CAP} kcal (${remaining})`;
        } else {
            emoji = '⚠️ ';
            kcalProgressText.textContent = `${emoji}${currentKcalSum} / ${KCAL_CAP} kcal (${Math.abs(remaining)} kcal Over)`;
        }

        if (currentKcalSum > KCAL_CAP) {
            kcalProgressFill.classList.remove('bg-green-500', 'bg-yellow-500', 'bg-gradient-to-r', 'from-green-400', 'to-green-600', 'from-amber-400', 'to-amber-600');
            kcalProgressFill.classList.add('bg-red-500', 'bg-gradient-to-r', 'from-red-400', 'to-red-600');
            kcalProgressText.classList.remove('text-gray-700', 'text-amber-600');
            kcalProgressText.classList.add('text-red-600');
        } else if (newPercentage >= 80) {
            kcalProgressFill.classList.remove('bg-green-500', 'bg-red-500', 'bg-gradient-to-r', 'from-green-400', 'to-green-600', 'from-red-400', 'to-red-600');
            kcalProgressFill.classList.add('bg-yellow-500', 'bg-gradient-to-r', 'from-amber-400', 'to-amber-600');
            kcalProgressText.classList.remove('text-gray-700', 'text-red-600');
            kcalProgressText.classList.add('text-amber-600');
        } else {
            kcalProgressFill.classList.remove('bg-red-500', 'bg-yellow-500', 'from-red-400', 'to-red-600', 'from-amber-400', 'to-amber-600');
            kcalProgressFill.classList.add('bg-green-500', 'bg-gradient-to-r', 'from-green-400', 'to-green-600');
            kcalProgressText.classList.remove('text-red-600', 'text-amber-600');
            kcalProgressText.classList.add('text-gray-700');
        }

        if ((lastPercentage < 50 && newPercentage >= 50) ||
            (lastPercentage < 80 && newPercentage >= 80) ||
            (lastPercentage < 100 && newPercentage >= 100) ||
            (lastPercentage <= 100 && newPercentage > 100)) {
            kcalProgressBarContainer.classList.add('animate-bounce-wiggle');
            kcalProgressText.classList.add('animate-bounce-wiggle');
            setTimeout(() => {
                kcalProgressBarContainer.classList.remove('animate-bounce-wiggle');
                kcalProgressText.classList.remove('animate-bounce-wiggle');
            }, 300);
        }
        lastPercentage = newPercentage;

        kcalProgressBarContainer.setAttribute('aria-valuenow', currentKcalSum);
        kcalProgressBarContainer.setAttribute('aria-valuetext', `${currentKcalSum} out of ${KCAL_CAP} kcal consumed today.`);
    }

    async function deleteNotionItem(pageId) {
        if (!confirm('Are you sure you want to delete this item?')) {
            return; // User cancelled
        }

        messageArea.textContent = 'Deleting item...';
        messageArea.style.color = '#3b82f6'; // Blue for info/loading
        notionItemsDisplay.style.opacity = '0.5'; // Dim the list

        try {
            const response = await fetch(NOTION_BACKEND_URL, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ pageId: pageId })
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Backend (DELETE) error:', errorData);
                throw new Error(`Error: ${errorData.message || errorData.error || 'Unknown deletion error'}`);
            }

            const result = await response.json();
            console.log('Successfully deleted from Notion via backend:', result);
            messageArea.textContent = 'Item deleted successfully!';
            messageArea.style.color = '#10b981'; // Green for success

            cachedNotionItems = null; // Invalidate 'Today' cache
            lastNotionFetchTime = 0;
            cachedHistoryData = null; // Invalidate 'History' cache
            lastHistoryFetchTime = 0;
            await displayNotionItemsFromCacheOrFetch(true); // Force re-fetch and update UI
            // If the user is on the History tab, trigger a refresh there too
            if (!sectionHistory.classList.contains('hidden')) {
                 await fetchAndDisplayHistoryData(true);
            }


        } catch (error) {
            console.error('Failed to delete item from Notion:', error);
            messageArea.textContent = `Error: ${error.message || 'Network error during deletion.'}`;
            messageArea.style.color = '#dc2626'; // Red for error
        } finally {
            notionItemsDisplay.style.opacity = '1'; // Restore opacity
            setTimeout(() => {
                messageArea.textContent = ''; // Clear message after a delay
            }, 3000);
        }
    }


    function renderNotionItems(items) {
        notionItemsDisplay.innerHTML = '';
        notionItemsDisplay.classList.remove('bg-gray-100');

        if (items.length === 0) {
            notionItemsDisplay.innerHTML = `
                <div class="text-center py-8">
                    <img src="https://cdn-icons-png.flaticon.com/256/3048/3048419.png" alt="Empty state icon" class="w-24 h-24 mx-auto mb-4 opacity-70">
                    <p class="text-gray-500 font-semibold text-lg">Nothing logged for today yet!</p>
                    <p class="text-gray-400 text-sm mt-1">Start by adding your first meal on the 'Add' tab.</p>
                </div>
            `;
        } else {
            items.forEach(item => {
                const descriptionPart = (item.name && item.name !== 'Untitled' && item.name !== 'Untitled Page' && item.name.trim() !== '') ? ` - ${item.name}` : '';
                const itemDiv = document.createElement('div');
                itemDiv.className = 'py-2 flex justify-between items-center border-b border-gray-100 last:border-b-0 last:pb-0 text-base md:text-lg group';
                itemDiv.innerHTML = `
                    <div class="flex-1 overflow-hidden text-ellipsis pr-2 font-semibold">
                        ${item.Type}${descriptionPart}
                    </div>
                    <div class="font-bold ${item.total < 0 ? 'text-red-500' : 'text-green-600'} flex items-center">
                        ${item.total}
                        <button class="delete-btn ml-2 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity duration-200" data-id="${item.id}" title="Delete item">
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1zm2 3a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1zm2 3a1 1 0 011-1h4a1 1 0 110 2H8a1 1 0 01-1-1z" clip-rule="evenodd" />
                            </svg>
                        </button>
                    </div>
                `;
                notionItemsDisplay.appendChild(itemDiv);
            });
        }
    }

    async function displayNotionItemsFromCacheOrFetch(forceFetch = false) {
        const now = Date.now();

        if (cachedNotionItems && (now - lastNotionFetchTime < NOTION_CACHE_DURATION) && !forceFetch) {
            console.log('Using cached Notion data for "Today" tab.');
            renderNotionItems(cachedNotionItems);
            return;
        }

        console.log('Fetching fresh Notion data for "Today" tab...');
        notionItemsDisplay.innerHTML = getSkeletonLoaderHtml(4);
        notionItemsDisplay.classList.add('bg-gray-100');

        let sumTotalKcal = 0;

        try {
            const response = await fetch(NOTION_BACKEND_URL, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Backend (GET today) error:', errorData);
                throw new Error(`Error: ${errorData.message || errorData.error || 'Unknown backend error'}`);
            }

            const data = await response.json();
            cachedNotionItems = data.items;
            lastNotionFetchTime = now;

            renderNotionItems(cachedNotionItems);
            sumTotalKcal = cachedNotionItems.reduce((sum, item) => sum + item.total, 0);
        } catch (error) {
            console.error('Failed to load items from Notion:', error);
            notionItemsDisplay.innerHTML = `<p class="text-center text-red-500">Failed to load items: ${error.message}</p>`;
            cachedNotionItems = null; // Clear cache on error
            lastNotionFetchTime = 0;
        } finally {
            updateKcalProgressBar(sumTotalKcal);
        }
    }

    // MODIFIED FUNCTION: renderHistoryData for single-line display
    function renderHistoryData(historyData) {
        historyItemsDisplay.innerHTML = ''; // Clear previous content
        historyItemsDisplay.classList.remove('bg-gray-100');
        historyItemsDisplay.classList.add('flex', 'flex-col'); // Adjust grid for smaller items

        if (!historyData || historyData.length === 0) {
            historyItemsDisplay.innerHTML = `
                <div class="col-span-full text-center py-8">
                    <img src="https://cdn-icons-png.flaticon.com/512/7465/7465225.png" alt="Empty history icon" class="w-24 h-24 mx-auto mb-4 opacity-70">
                    <p class="text-gray-500 font-semibold text-lg">No history data available yet!</p>
                    <p class="text-gray-400 text-sm mt-1">Log some meals to see your past weeks.</p>
                </div>
            `;
            return;
        }

        historyData.forEach(week => {
            const excess = week.excess; // Direct use of excess from backend
            let excessText = '';
            let excessClass = '';
            let emoji = '';
            let borderColor = 'border-gray-200';
            let bgColor = 'bg-gray-50';

            if (excess > 0) {
                excessText = `+${excess}`;
                excessClass = 'text-red-600';
                borderColor = 'border-red-300';
                bgColor = 'bg-red-50';
            } else if (excess < 0) {
                excessText = `${excess}`;
                excessClass = 'text-green-600';
                borderColor = 'border-green-300';
                bgColor = 'bg-green-50';
            } else {
                excessText = `On Target`;
                excessClass = 'text-gray-700';
                borderColor = 'border-blue-300';
                bgColor = 'bg-blue-50';
            }

            const weekDiv = document.createElement('div');
            // Modified innerHTML to be a single line display
            weekDiv.className = `flex items-center justify-between p-3 rounded-lg shadow-sm border-l-4 ${borderColor} ${bgColor} transition-all duration-300 ease-in-out hover:shadow-md hover:scale-[1.01] text-base font-semibold`;
            weekDiv.innerHTML = `
                <span class="text-gray-800">${week.weekRange}</span>
                <span class="${excessClass}">${excessText}</span>
            `;
            historyItemsDisplay.appendChild(weekDiv);
        });
    }

    async function fetchAndDisplayHistoryData(forceFetch = false) {
        const now = Date.now();

        if (cachedHistoryData && (now - lastHistoryFetchTime < HISTORY_CACHE_DURATION) && !forceFetch) {
            console.log('Using cached history data for "History" tab.');
            renderHistoryData(cachedHistoryData);
            return;
        }

        console.log('Fetching fresh history data...');
        historyItemsDisplay.innerHTML = getSkeletonLoaderHtml(6);
        historyItemsDisplay.classList.add('bg-gray-100');

        try {
            const response = await fetch(`${NOTION_BACKEND_URL}?period=history`, {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Backend (GET history) error:', errorData);
                throw new Error(`Error: ${errorData.message || errorData.error || 'Unknown backend error'}`);
            }

            const data = await response.json();
            cachedHistoryData = data.history;
            lastHistoryFetchTime = now;

            renderHistoryData(cachedHistoryData);

        } catch (error) {
            console.error('Failed to load history data:', error);
            historyItemsDisplay.innerHTML = `<p class="text-center text-red-500 col-span-full">Failed to load history: ${error.message}</p>`;
            cachedHistoryData = null;
            lastHistoryFetchTime = 0;
        } finally {
            // No specific progress bar to update here, but ensure UI is ready
        }
    }


    sendBtn.addEventListener('click', function() {
        const category = hiddenCategoryInput.value;
        const description = descriptionInput.value;
        let kcal = kcalInput.value.trim();

        if (!category) {
            messageArea.textContent = 'Please select a category.';
            messageArea.style.color = '#dc2626';
            return;
        }

        if (!kcal) {
            const placeholderMatch = kcalInput.placeholder.match(/-?\d+/);
            if (placeholderMatch) {
                kcal = placeholderMatch[0];
            } else {
                messageArea.textContent = 'Please enter a valid kcal value or ensure a default is available.';
                messageArea.style.color = '#dc2626';
                return;
            }
        }

        if (isNaN(parseFloat(kcal))) {
            messageArea.textContent = 'Please enter a valid kcal value.';
            messageArea.style.color = '#dc2626';
            return;
        }

        kcal = parseInt(kcal, 10);

        sendToNotion({ category, description, kcal });
    });

    tabCategoryBtn.addEventListener('click', () => showTab('category'));
    tabTodayBtn.addEventListener('click', () => showTab('today'));
    tabHistoryBtn.addEventListener('click', () => showTab('history'));

    // Event listener for delete buttons using event delegation
    notionItemsDisplay.addEventListener('click', function(event) {
        const deleteButton = event.target.closest('.delete-btn');
        if (deleteButton) {
            const pageIdToDelete = deleteButton.dataset.id;
            if (pageIdToDelete) {
                deleteNotionItem(pageIdToDelete);
            }
        }
    });

    // Initial load
    displayNotionItemsFromCacheOrFetch();
    showTab('category');
    updateDescriptionPlaceholder("Breakfast");

    // Add preconnect tags dynamically
    const preconnectTailwind = document.createElement('link');
    preconnectTailwind.rel = 'preconnect';
    preconnectTailwind.href = 'https://cdn.tailwindcss.com';
    document.head.appendChild(preconnectTailwind);

    const preconnectFlaticon = document.createElement('link');
    preconnectFlaticon.rel = 'preconnect';
    preconnectFlaticon.href = 'https://cdn-icons-png.flaticon.com';
    document.head.appendChild(preconnectFlaticon);
});
