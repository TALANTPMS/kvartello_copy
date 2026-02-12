// Конфигурация API
// Используем Vercel API route (работает и локально через vercel dev, и на продакшене)
const API_URL = '/api/chat';
const MODEL = 'gpt-4.1-mini';
const MAX_TOKENS = 300;
const MAX_HISTORY = 10; // Сохраняем только 10 последних сообщений

// Элементы DOM
const chatForm = document.getElementById('chatForm');
const chatInput = document.getElementById('chatInput');
const chatMessages = document.getElementById('chatMessages');
const sendBtn = document.getElementById('sendBtn');
const chatWindow = document.querySelector('.chat-window');

// Рингтон для сообщений
const ringtone = new Audio('sounds/ringtone.mp3');

function playRingtone() {
    // Останавливаем предыдущее воспроизведение чтобы не было наложений
    ringtone.pause();
    ringtone.currentTime = 0;
    ringtone.play().catch(() => {}); // catch на случай если браузер блокирует автозвук
}

// История сообщений для контекста
let messageHistory = [];
let systemPrompt = '';

// Загрузка системного промпта
async function loadSystemPrompt() {
    try {
        // Загружаем оба файла параллельно
        const [sysResponse, userResponse] = await Promise.all([
            fetch('prompts/sys-prompt.txt'),
            fetch('prompts/user-prompt')
        ]);
        
        let sysPromptText = '';
        let userPromptText = '';
        
        if (sysResponse.ok) {
            sysPromptText = await sysResponse.text();
        } else {
            console.warn('Не удалось загрузить sys-prompt.txt');
        }
        
        if (userResponse.ok) {
            userPromptText = await userResponse.text();
        } else {
            console.warn('Не удалось загрузить user-prompt');
        }
        
        // Объединяем оба промпта
        if (sysPromptText || userPromptText) {
            systemPrompt = sysPromptText + (sysPromptText && userPromptText ? '\n\n' : '') + userPromptText;
            // Добавляем системное сообщение в историю
            messageHistory.push({ role: 'system', content: systemPrompt });
        } else {
            // Если оба файла не загрузились, используем дефолтный промпт
            console.warn('Не удалось загрузить промпты, используется по умолчанию');
            systemPrompt = 'Ты — Диана, виртуальный AI-консультант. Отвечай дружелюбно и профессионально.';
            messageHistory.push({ role: 'system', content: systemPrompt });
        }
    } catch (error) {
        console.error('Ошибка при загрузке промптов:', error);
        systemPrompt = 'Ты — Диана, виртуальный AI-консультант. Отвечай дружелюбно и профессионально.';
        messageHistory.push({ role: 'system', content: systemPrompt });
    }
}

// Инициализация диалога
async function initializeDialog() {
    const loadingId = addLoadingMessage();
    sendBtn.disabled = true;
    chatInput.disabled = true;
    
    try {
        // Добавляем инициализирующее сообщение пользователя
        messageHistory.push({ role: 'user', content: 'Начни диалог следуя правилам системного промпта' });
        
        // Отправляем запрос к API
        const botResponse = await sendMessageToAPI(messageHistory);
        
        // Добавляем ответ бота в чат (передаём loadingId чтобы не мигал)
        await addBotMessage(botResponse, loadingId);
        
        // Добавляем ответ в историю
        messageHistory.push({ role: 'assistant', content: botResponse });
        
    } catch (error) {
        console.error('Ошибка при инициализации диалога:', error);
        await addBotMessage('Здравствуйте! Я Диана, ваш AI-консультант. Чем могу помочь?', loadingId);
    } finally {
        sendBtn.disabled = false;
        chatInput.disabled = false;
        chatInput.focus();
    }
}

// Инициализация
document.addEventListener('DOMContentLoaded', async () => {
    chatForm.addEventListener('submit', handleSubmit);
    
    // Cookie Banner
    initCookieBanner();

    // Модалка "Заказать звонок"
    initCallModal();
    
    // Загружаем системный промпт
    await loadSystemPrompt();
    
    // Инициализируем диалог
    await initializeDialog();
});

// Cookie Banner
function initCookieBanner() {
    const banner = document.getElementById('cookieBanner');
    const acceptBtn = document.getElementById('cookieAcceptBtn');
    if (!banner || !acceptBtn) return;
    
    banner.style.display = 'flex';
    
    acceptBtn.addEventListener('click', function() {
        // TODO: раскомментировать для продакшена
        // localStorage.setItem('cookiesAccepted', 'true');
        banner.style.opacity = '0';
        setTimeout(() => { banner.style.display = 'none'; }, 300);
    });
}

// Модалка "Заказать звонок"
function initCallModal() {
    const modal = document.getElementById('callModal');
    const closeBtn = document.getElementById('modalClose');
    const openBtns = document.querySelectorAll('[data-remodal-target="modal-form-call"]');
    const form = document.getElementById('callForm');

    if (!modal) return;

    // Открытие модалки
    openBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
    });

    // Закрытие по крестику
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        });
    }

    // Закрытие по клику на оверлей
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    });

    // Закрытие по Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    });

    // Обработка формы
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            // Здесь можно добавить отправку данных на сервер
            alert('Спасибо! Мы свяжемся с вами в ближайшее время.');
            modal.classList.remove('active');
            document.body.style.overflow = '';
            form.reset();
        });
    }
}

// Обработка отправки формы
async function handleSubmit(e) {
    e.preventDefault();
    
    const userMessage = chatInput.value.trim();
    if (!userMessage) return;
    
    // Очищаем поле ввода
    chatInput.value = '';
    
    // Добавляем сообщение пользователя в чат
    addUserMessage(userMessage);
    
    // Добавляем в историю
    messageHistory.push({ role: 'user', content: userMessage });
    
    // Ограничиваем историю до 10 последних сообщений (сохраняя системное сообщение)
    limitMessageHistory();
    
    // Показываем индикатор загрузки
    const loadingId = addLoadingMessage();
    
    // Блокируем кнопку отправки
    sendBtn.disabled = true;
    chatInput.disabled = true;
    
    try {
        // Отправляем запрос к API
        const botResponse = await sendMessageToAPI(messageHistory);
        
        // Добавляем ответ бота в чат (передаём loadingId чтобы не мигал)
        await addBotMessage(botResponse, loadingId);
        
        // Добавляем ответ в историю
        messageHistory.push({ role: 'assistant', content: botResponse });
        
        // Ограничиваем историю снова (сохраняя системное сообщение)
        limitMessageHistory();
        
    } catch (error) {
        console.error('Ошибка при отправке сообщения:', error);
        await addBotMessage('Извините, произошла ошибка. Попробуйте еще раз.', loadingId);
    } finally {
        // Разблокируем кнопку отправки
        sendBtn.disabled = false;
        chatInput.disabled = false;
        chatInput.focus();
    }
}

// Отправка сообщения к API через Vercel Serverless Function
async function sendMessageToAPI(history) {
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            model: MODEL,
            messages: history,
            max_tokens: MAX_TOKENS,
            temperature: 0.7
        })
    });
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data.choices[0].message.content.trim();
}

// Ограничение истории сообщений
function limitMessageHistory() {
    if (messageHistory.length > MAX_HISTORY * 2 + 1) {
        const systemMsg = messageHistory[0];
        const recentMessages = messageHistory.slice(-MAX_HISTORY * 2);
        messageHistory = [systemMsg, ...recentMessages];
    }
}

// Универсальная функция для отправки запроса и обработки ответа бота
async function sendAndProcessBotResponse() {
    const loadingId = addLoadingMessage();
    sendBtn.disabled = true;
    chatInput.disabled = true;
    
    try {
        const botResponse = await sendMessageToAPI(messageHistory);
        
        // Добавляем ответ бота в чат (передаём loadingId чтобы не мигал)
        await addBotMessage(botResponse, loadingId);
        
        // Добавляем ответ в историю
        messageHistory.push({ role: 'assistant', content: botResponse });
        
        // Ограничиваем историю
        limitMessageHistory();
    } catch (error) {
        console.error('Ошибка при отправке сообщения:', error);
        await addBotMessage('Извините, произошла ошибка. Попробуйте еще раз.', loadingId);
    } finally {
        sendBtn.disabled = false;
        chatInput.disabled = false;
        chatInput.focus();
    }
}

// Добавление сообщения пользователя
function addUserMessage(text) {
    const messageDiv = createMessageElement('user', text);
    chatMessages.appendChild(messageDiv);
    adjustChatWindowHeight();
    scrollToBottom();
}

// Задержка для имитации печатания (зависит от длины текста)
function getTypingDelay(text) {
    if (!text) return 1100;
    const len = text.length;
    // Минимум 1000мс, ~15мс на символ, максимум 2500мс
    return Math.min(Math.max(1000, len * 15), 2500);
}

// Задержки для разных типов элементов
const DELAY = {
    TEXT: (text) => getTypingDelay(text),   // текстовый пузырёк
    BUTTONS: 1500,                           // кнопки выбора
    MESSENGER: 900,                         // выбор мессенджера
    INPUT_FORM: 800,                        // формы ввода
    GALLERY: 1000,                          // галерея
    START_QUESTIONS: 1000,                  // стартовые вопросы
    ACCEPTED: 800,                          // плашка заявки
};

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Показать индикатор печатания
function showTypingIndicator() {
    return addLoadingMessage();
}

// Добавление сообщения бота (с задержками)
// existingLoader — если передан, переиспользует уже показанный индикатор для первого элемента
async function addBotMessage(text, existingLoader) {
    const processedText = processBotMessage(text);
    
    // Собираем все элементы для последовательного вывода
    const queue = [];
    
    if (processedText.hasMarkers) {
        for (const part of processedText.textParts) {
            if (part.trim()) {
                queue.push({ type: 'text', content: part, delay: DELAY.TEXT(part) });
            }
        }
        for (const marker of processedText.markers) {
            const markerType = typeof marker === 'string' ? marker : marker.type;
            if (markerType === 'MESSAGE_DIVIDER') continue;
            
            let delay = 400;
            switch (markerType) {
                case 'START_QUESTIONS': delay = DELAY.START_QUESTIONS; break;
                case 'BUTTON': delay = DELAY.BUTTONS; break;
                case 'ASK_MESSENGER': delay = DELAY.MESSENGER; break;
                case 'NAME_INPUT': delay = DELAY.INPUT_FORM; break;
                case 'PHONE_INPUT': delay = DELAY.INPUT_FORM; break;
                case 'REQUEST_ACCEPTED': delay = DELAY.ACCEPTED; break;
                case 'SHOW_GALLERY': delay = DELAY.GALLERY; break;
            }
            queue.push({ type: 'marker', marker: marker, delay: delay });
        }
    } else {
        const content = processedText.textParts[0] || text;
        queue.push({ type: 'text', content: content, delay: DELAY.TEXT(content) });
    }
    
    // Для первого элемента: переиспользуем существующий индикатор или создаём новый
    let loader = existingLoader || addLoadingMessage();
    
    for (let i = 0; i < queue.length; i++) {
        const item = queue[i];
        
        // Ждём задержку, затем убираем индикатор
        await sleep(item.delay);
        removeLoadingMessage(loader);
        
        // Звук при появлении сообщения
        playRingtone();
        
        // Выводим элемент
        if (item.type === 'text') {
            const messageDiv = createMessageElement('bot', item.content);
            chatMessages.appendChild(messageDiv);
        } else {
            handleMarker(item.marker);
        }
        
        adjustChatWindowHeight();
        scrollToBottom();
        
        // Если не последний — сразу показываем новый индикатор
        if (i < queue.length - 1) {
            loader = addLoadingMessage();
        }
    }
}

// Обработка сообщения бота и извлечение меток
function processBotMessage(text) {
    const markers = [];
    const textParts = [];
    let currentText = text;
    
    // Ищем метку BUTTON с опциями
    const buttonPattern = /\[BUTTON:\s*([^\]]+)\]/g;
    const buttonMatches = [];
    let buttonMatch;
    while ((buttonMatch = buttonPattern.exec(currentText)) !== null) {
        const options = buttonMatch[1].split('|').map(opt => opt.trim()).filter(opt => opt);
        markers.push({ type: 'BUTTON', options: options });
        buttonMatches.push(buttonMatch[0]);
    }
    // Удаляем метки BUTTON из текста
    buttonMatches.forEach(match => {
        currentText = currentText.replace(match, '');
    });
    
    // Ищем остальные метки
    const markerPatterns = [
        { pattern: /\[START_QUESTIONS\]/g, type: 'START_QUESTIONS' },
        { pattern: /\[MESSAGE_DIVIDER\]/g, type: 'MESSAGE_DIVIDER' },
        { pattern: /\[ASK_MESSENGER\]/g, type: 'ASK_MESSENGER' },
        { pattern: /\[NAME_INPUT\]/g, type: 'NAME_INPUT' },
        { pattern: /\[PHONE_INPUT\]/g, type: 'PHONE_INPUT' },
        { pattern: /\[REQUEST_ACCEPTED\]/g, type: 'REQUEST_ACCEPTED' },
        { pattern: /\[SHOW_GALLERY\]/g, type: 'SHOW_GALLERY' }
    ];
    
    // Удаляем метки из текста и сохраняем их
    markerPatterns.forEach(({ pattern, type }) => {
        if (pattern.test(currentText)) {
            markers.push({ type: type });
            currentText = currentText.replace(pattern, '');
        }
    });
    
    // Разделяем текст по меткам MESSAGE_DIVIDER (если они были)
    const hasMessageDivider = markers.some(m => (typeof m === 'string' ? m : m.type) === 'MESSAGE_DIVIDER');
    if (hasMessageDivider) {
        // Разделяем на абзацы или предложения
        const parts = currentText.split(/\n\n+/).filter(p => p.trim());
        if (parts.length > 0) {
            textParts.push(...parts);
        } else {
            textParts.push(currentText);
        }
    } else {
        textParts.push(currentText.trim());
    }
    
    return {
        textParts: textParts.filter(p => p.trim()),
        markers: markers,
        hasMarkers: markers.length > 0
    };
}

// Обработка меток
function handleMarker(marker) {
    const markerType = typeof marker === 'string' ? marker : marker.type;
    
    switch (markerType) {
        case 'START_QUESTIONS':
            showStartQuestions();
            break;
        case 'BUTTON':
            showButtons(marker.options);
            break;
        case 'ASK_MESSENGER':
            showMessengerOptions();
            break;
        case 'NAME_INPUT':
            showNameInputForm();
            break;
        case 'PHONE_INPUT':
            showPhoneInputForm();
            break;
        case 'REQUEST_ACCEPTED':
            showRequestAccepted();
            break;
        case 'SHOW_GALLERY':
            showGallery();
            break;
    }
}

// Показать стартовые вопросы
function showStartQuestions() {
    const questionsContainer = document.createElement('div');
    questionsContainer.className = 'start-questions-container';
    
    const questions = [
        'Сколько стоит ремонт квартиры?',
        'Какие виды ремонта вы делаете?',
        'Какие сроки ремонта?',
        'Нужна ли предоплата?',
        'Какие гарантии вы даёте?',
        'Посмотреть примеры работ',
        'Делаете ли вы дизайн-проект?',
        'Хочу задать свой вопрос'
    ];
    
    questions.forEach((question, index) => {
        const questionBtn = document.createElement('button');
        questionBtn.className = 'start-question-btn';
        questionBtn.textContent = question;
        questionBtn.addEventListener('click', () => {
            // Добавляем выбранный вопрос как сообщение пользователя
            addUserMessage(question);
            messageHistory.push({ role: 'user', content: question });
            
            // Удаляем контейнер с вопросами и текстом
            questionsContainer.remove();
            
            // Отправляем запрос к API
            handleQuestionSelection();
        });
        questionsContainer.appendChild(questionBtn);
    });
    
    
    chatMessages.appendChild(questionsContainer);
    adjustChatWindowHeight();
    scrollToBottom();
}

// Обработка выбранного вопроса
async function handleQuestionSelection() {
    await sendAndProcessBotResponse();
}

// Показать кнопки с опциями
function showButtons(options) {
    if (!options || options.length === 0) return;
    
    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'buttons-container';
    
    options.forEach((option) => {
        const button = document.createElement('button');
        button.className = 'option-button';
        button.textContent = option;
        button.addEventListener('click', () => {
            // Добавляем выбранную опцию как сообщение пользователя
            addUserMessage(option);
            messageHistory.push({ role: 'user', content: option });
            
            // Удаляем контейнер с кнопками
            buttonsContainer.remove();
            
            // Отправляем запрос к API
            handleButtonSelection();
        });
        buttonsContainer.appendChild(button);
    });
    
    chatMessages.appendChild(buttonsContainer);
    adjustChatWindowHeight();
    scrollToBottom();
}

// Обработка выбранной опции из кнопок
async function handleButtonSelection() {
    await sendAndProcessBotResponse();
}

// Показать варианты мессенджеров
function showMessengerOptions() {
    const messengersContainer = document.createElement('div');
    messengersContainer.className = 'messengers-container';
    
    const messengers = ['WhatsApp', 'Telegram', 'Max'];
    
    messengers.forEach((messenger) => {
        const button = document.createElement('button');
        button.className = 'messenger-button';
        button.textContent = messenger;
        button.addEventListener('click', () => {
            // Добавляем выбранный мессенджер как сообщение пользователя
            addUserMessage(messenger);
            messageHistory.push({ role: 'user', content: messenger });
            
            // Удаляем контейнер с кнопками
            messengersContainer.remove();
            
            // Отправляем запрос к API
            handleMessengerSelection();
        });
        messengersContainer.appendChild(button);
    });
    
    chatMessages.appendChild(messengersContainer);
    adjustChatWindowHeight();
    scrollToBottom();
}

// Обработка выбранного мессенджера
async function handleMessengerSelection() {
    await sendAndProcessBotResponse();
}

// Показать форму ввода имени
function showNameInputForm() {
    const formContainer = document.createElement('div');
    formContainer.className = 'input-form-container';
    
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'name-input';
    input.placeholder = 'Введите ваше имя';
    
    const submitBtn = document.createElement('button');
    submitBtn.type = 'button';
    submitBtn.className = 'form-submit-btn';
    submitBtn.textContent = 'Отправить';
    
    submitBtn.addEventListener('click', () => {
        const name = input.value.trim();
        if (name) {
            // Добавляем имя как сообщение пользователя
            addUserMessage(`Имя: ${name}`);
            messageHistory.push({ role: 'user', content: `Имя: ${name}` });
            
            // Сохраняем имя для дальнейшего использования
            window.userName = name;
            
            formContainer.remove();
            
            // Продолжаем диалог
            continueAfterNameInput();
        }
    });
    
    formContainer.appendChild(input);
    formContainer.appendChild(submitBtn);
    chatMessages.appendChild(formContainer);
    adjustChatWindowHeight();
    scrollToBottom();
}

// Продолжение после ввода имени
async function continueAfterNameInput() {
    await sendAndProcessBotResponse();
}

// Показать форму ввода телефона
function showPhoneInputForm() {
    const formContainer = document.createElement('div');
    formContainer.className = 'input-form-container';
    
    const input = document.createElement('input');
    input.type = 'tel';
    input.className = 'phone-input';
    input.placeholder = 'Ваш телефон';
    
    const submitBtn = document.createElement('button');
    submitBtn.type = 'button';
    submitBtn.className = 'form-submit-btn';
    submitBtn.textContent = 'Отправить';
    
    submitBtn.addEventListener('click', () => {
        const phone = input.value.trim();
        
        if (phone) {
            addUserMessage(`Телефон: ${phone}`);
            messageHistory.push({ role: 'user', content: `Телефон: ${phone}` });
            window.userPhone = phone;
            
            formContainer.remove();
            continueAfterPhoneInput();
        }
    });
    
    formContainer.appendChild(input);
    formContainer.appendChild(submitBtn);
    chatMessages.appendChild(formContainer);
    adjustChatWindowHeight();
    scrollToBottom();
}

// Продолжение после ввода телефона
async function continueAfterPhoneInput() {
    await sendAndProcessBotResponse();
}

// Показать плашку о принятии заявки
function showRequestAccepted() {
    const acceptedDiv = document.createElement('div');
    acceptedDiv.className = 'request-accepted';
    acceptedDiv.innerHTML = `
        <div class="accepted-content">
            <strong>✓ Заявка принята!</strong>
            <p>Ваша заявка успешно отправлена. Мы свяжемся с вами в ближайшее время.</p>
        </div>
    `;
    chatMessages.appendChild(acceptedDiv);
    adjustChatWindowHeight();
    scrollToBottom();
}

// Показать галерею примеров работ
let gallerySwiperCount = 0;

function showGallery() {
    gallerySwiperCount++;
    const uniqueClass = `gallery-swiper-${gallerySwiperCount}`;

    const galleryContainer = document.createElement('div');
    galleryContainer.className = 'gallery-container';

    const images = ['images/ex1.png', 'images/ex2.png', 'images/ex3.png'];

    galleryContainer.innerHTML = `
        <div class="swiper ${uniqueClass} gallery-swiper">
            <div class="swiper-wrapper">
                ${images.map((src, i) => `
                    <div class="swiper-slide">
                        <img src="${src}" alt="Пример работы ${i + 1}">
                    </div>
                `).join('')}
            </div>
            <div class="swiper-button-prev"></div>
            <div class="swiper-button-next"></div>
        </div>
    `;

    chatMessages.appendChild(galleryContainer);
    adjustChatWindowHeight();
    scrollToBottom();

    // Инициализируем Swiper после вставки в DOM
    setTimeout(() => {
        new Swiper(`.${uniqueClass}`, {
            slidesPerView: 1,
            spaceBetween: 10,
            loop: true,
            navigation: {
                nextEl: `.${uniqueClass} .swiper-button-next`,
                prevEl: `.${uniqueClass} .swiper-button-prev`,
            },
            breakpoints: {
                768: {
                    slidesPerView: 2,
                    spaceBetween: 12,
                },
                1024: {
                    slidesPerView: 3,
                    spaceBetween: 15,
                }
            }
        });
        adjustChatWindowHeight();
        scrollToBottom();
    }, 50);
}

// Создание элемента сообщения
function createMessageElement(type, text) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message message-${type}`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = text;
    
    const timeDiv = document.createElement('div');
    timeDiv.className = 'message-time';
    timeDiv.textContent = getCurrentTime();
    
    contentDiv.appendChild(timeDiv);
    messageDiv.appendChild(contentDiv);
    
    return messageDiv;
}

// Добавление индикатора загрузки (возвращает сам элемент)
function addLoadingMessage() {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message message-bot loading-indicator';
    
    const loadingContent = document.createElement('div');
    loadingContent.className = 'loading';
    
    const dots = document.createElement('div');
    dots.className = 'loading-dots';
    dots.innerHTML = '<span></span><span></span><span></span>';
    
    loadingContent.appendChild(dots);
    loadingDiv.appendChild(loadingContent);
    chatMessages.appendChild(loadingDiv);
    
    adjustChatWindowHeight();
    scrollToBottom();
    
    return loadingDiv;
}

// Удаление индикатора загрузки
function removeLoadingMessage(el) {
    if (el && el.parentNode) {
        el.remove();
    }
}

// Получение текущего времени
function getCurrentTime() {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}

// Прокрутка вниз
function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Автоматическое увеличение высоты окна чата
function adjustChatWindowHeight() {
    const messagesHeight = chatMessages.scrollHeight;
    const inputAreaHeight = document.querySelector('.chat-input-area').offsetHeight;
    const avatarHeight = document.querySelector('.chat-avatar').offsetHeight;
    
    // Минимальная высота окна
    const minHeight = 400;
    
    // Вычисляем необходимую высоту
    const requiredHeight = messagesHeight + inputAreaHeight;
    
    // Если контент больше минимальной высоты, увеличиваем окно
    if (requiredHeight > minHeight) {
        chatWindow.style.height = 'auto';
        chatWindow.style.minHeight = `${Math.max(requiredHeight, minHeight)}px`;
    } else {
        chatWindow.style.minHeight = `${minHeight}px`;
    }
    
    // Прокручиваем вниз после изменения высоты
    setTimeout(() => {
        scrollToBottom();
    }, 10);
}

