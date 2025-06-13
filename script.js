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
    const sectionCategory = document.getElementById('section-category');
    const sectionToday = document.getElementById('section-today');

    // --- NOTION API ENDPOINT CONFIGURATION ---
    const NOTION_BACKEND_URL = 
        window.location.hostname === 'localhost' ?
        '/api/pantryapi' :
        'https://pantrypal-gilt.vercel.app/api/pantryapi';

    console.log(window.location.hostname)
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

    function showTab(tabName) {
        setTabActiveState(tabCategoryBtn, false);
        setTabActiveState(tabTodayBtn, false);

        sectionCategory.classList.add('hidden');
        sectionToday.classList.add('hidden');

        if (tabName === 'category') {
            setTabActiveState(tabCategoryBtn, true);
            sectionCategory.classList.remove('hidden');
        } else if (tabName === 'today') {
            setTabActiveState(tabTodayBtn, true);
            sectionToday.classList.remove('hidden');
            displayNotionItemsFromCacheOrFetch();
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
            kcalInput.placeholder = `kcal (${placeholderValue})`;
        } else {
            kcalInput.placeholder = "kcal (350)";
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
            kcalInput.placeholder = "kcal (300)";

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

            cachedNotionItems = null; // Mark cache as stale
            lastNotionFetchTime = 0; // Reset fetch time
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

    function renderNotionItems(items) {
        notionItemsDisplay.innerHTML = '';
        notionItemsDisplay.classList.remove('bg-gray-100');

        if (items.length === 0) {
            notionItemsDisplay.innerHTML = `
                <div class="text-center py-8">
                    <img src="https://cdn-icons-png.flaticon.com/512/7465/7465225.png" alt="Empty state icon" class="w-24 h-24 mx-auto mb-4 opacity-70">
                    <p class="text-gray-500 font-semibold text-lg">Nothing logged for today yet!</p>
                    <p class="text-gray-400 text-sm mt-1">Start by adding your first meal on the 'Add' tab.</p>
                </div>
            `;
        } else {
            items.forEach(item => {
                const descriptionPart = (item.name && item.name !== 'Untitled' && item.name !== 'Untitled Page' && item.name.trim() !== '') ? ` - ${item.name}` : '';
                const itemDiv = document.createElement('div');
                itemDiv.className = 'py-2 flex justify-between items-center border-b border-gray-100 last:border-b-0 last:pb-0 text-base md:text-lg';
                itemDiv.innerHTML = `
                    <div class="flex-1 overflow-hidden text-ellipsis pr-2 font-semibold">
                        ${item.Type}${descriptionPart}
                    </div>
                    <div class="font-bold ${item.total < 0 ? 'text-red-500' : 'text-green-600'} flex items-center">
                        ${item.total}
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
                console.error('Backend (GET) error:', errorData);
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

    sendBtn.addEventListener('click', function() {
        const category = hiddenCategoryInput.value;
        const description = descriptionInput.value;
        let kcal = kcalInput.value;

        if (!category) {
            messageArea.textContent = 'Please select a category.';
            messageArea.style.color = '#dc2626';
            return;
        }
        if (!kcal) {
            const placeholderMatch = kcalInput.placeholder.match(/-?\d+/); // Regex to find a number (positive or negative)
            if (placeholderMatch) {
                kcal = placeholderMatch[0]; // Use the extracted number string
            } else {
                // Fallback if placeholder doesn't contain a valid number (shouldn't happen with current setup)
                messageArea.textContent = 'Please enter a valid kcal value or ensure a default is available.';
                messageArea.style.color = '#dc2626';
                return;
            }
        }

        if (isNaN(parseFloat(kcal))) { // Validate after potentially setting from placeholder
            messageArea.textContent = 'Please enter a valid kcal value.';
            messageArea.style.color = '#dc2626';
            return;
        }

        kcal = parseInt(kcal, 10); // Parse to integer

        sendToNotion({ category, description, kcal });
    });

    tabCategoryBtn.addEventListener('click', () => showTab('category'));
    tabTodayBtn.addEventListener('click', () => showTab('today'));

    // Initial load: Fetch data on page load for the progress bar and to cache for 'Today' tab
    displayNotionItemsFromCacheOrFetch();
    showTab('category'); // Ensure the 'Add' tab is shown initially
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