// ========================
// game.js - МЕССЕНДЖЕР-СТИЛЬ
// ========================

// Telegram
try {
    if (window.Telegram?.WebApp) {
        window.Telegram.WebApp.expand();
    }
} catch (e) {}

// ========================
// СОСТОЯНИЕ ИГРЫ
// ========================
let gameState = {
    currentScene: "start",
    gameStarted: false,
    messageHistory: [],       // История всех сообщений
    currentMessageIndex: 0,   // Текущее сообщение в сцене
    waitingForChoice: false   // Ожидание выбора
};

// ========================
// УПРАВЛЕНИЕ АНИМАЦИЕЙ
// ========================
let currentAnimation = null;

function stopCurrentAnimation() {
    if (currentAnimation) {
        clearTimeout(currentAnimation);
        currentAnimation = null;
    }
}

// ========================
// СОХРАНЕНИЕ/ЗАГРУЗКА
// ========================
function loadGame() {
    try {
        const saved = localStorage.getItem('storySave');
        if (saved) {
            const parsed = JSON.parse(saved);
            if (parsed.currentScene && scenes[parsed.currentScene]) {
                gameState = { ...gameState, ...parsed };
                console.log('Сохранение загружено');
            }
        }
    } catch (e) {
        console.log('Ошибка загрузки');
    }
}

function saveGame() {
    try {
        localStorage.setItem('storySave', JSON.stringify(gameState));
    } catch (e) {}
}

// ========================
// ДОБАВЛЕНИЕ СООБЩЕНИЯ
// ========================
function addMessage(text, sender = "game") {
    const wrapper = document.querySelector('.messages-wrapper');
    if (!wrapper) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    messageDiv.textContent = text;
    
    wrapper.appendChild(messageDiv);
    
    // Прокрутка к новому сообщению
    setTimeout(() => {
        wrapper.scrollTop = wrapper.scrollHeight;
    }, 10);
    
    return messageDiv;
}

// ========================
// ПОБУКВЕННАЯ ПЕЧАТЬ СООБЩЕНИЯ
// ========================
function typeMessage(text, messageElement, speed = 10, callback = null) {
    stopCurrentAnimation();
    
    let index = 0;
    messageElement.textContent = '';
    
    function addChar() {
        if (index < text.length) {
            messageElement.textContent += text[index];
            index++;
            
            // Автопрокрутка при печати
            const wrapper = document.querySelector('.messages-wrapper');
            if (wrapper) {
                wrapper.scrollTop = wrapper.scrollHeight;
            }
            
            currentAnimation = setTimeout(addChar, speed);
        } else {
            currentAnimation = null;
            if (callback) callback();
        }
    }
    
    addChar();
}

// ========================
// ПОКАЗ ВАРИАНТОВ ВЫБОРА
// ========================
function showChoices(choices) {
    const choicesContainer = document.getElementById('choices');
    if (!choicesContainer) return;
    
    // Очищаем контейнер
    while (choicesContainer.firstChild) {
        choicesContainer.removeChild(choicesContainer.firstChild);
    }
    
    // Создаем кнопки
    choices.forEach(choice => {
        const button = document.createElement('button');
        button.className = `choice-btn ${choice.style || ''}`;
        button.textContent = choice.text;
        
        button.onclick = () => {
            stopCurrentAnimation();
            
            // Добавляем выбор игрока как сообщение
            addMessage(`→ ${choice.text}`, "player");
            
            // Скрываем кнопки
            while (choicesContainer.firstChild) {
                choicesContainer.removeChild(choicesContainer.firstChild);
            }
            
            // Применяем эффект
            if (choice.effect) choice.effect();
            
            // Переходим к следующей сцене
            if (choice.nextScene) {
                gameState.waitingForChoice = false;
                loadScene(choice.nextScene);
            }
            
            saveGame();
        };
        
        choicesContainer.appendChild(button);
    });
    
    gameState.waitingForChoice = true;
}

// ========================
// ЗАГРУЗКА СЦЕНЫ
// ========================
function loadScene(sceneId) {
    const scene = scenes[sceneId];
    if (!scene) return;
    
    stopCurrentAnimation();
    gameState.currentScene = sceneId;
    gameState.currentMessageIndex = 0;
    gameState.waitingForChoice = false;
    
    // Меняем фон
    const bgElement = document.getElementById('background');
    if (bgElement) {
        bgElement.style.backgroundImage = scene.background || '';
    }
    
    // Удаляем старый слушатель кликов
    removeFullscreenClickListener();
    
    // Запускаем первую страницу
    if (scene.type === "multi-page") {
        showNextMessage(sceneId, 0);
    } else {
        // Обычная сцена - одно сообщение + выбор
        const messageDiv = addMessage(scene.text);
        typeMessage(scene.text, messageDiv, 25, () => {
            if (scene.choices) {
                showChoices(scene.choices);
            }
        });
    }
    
    saveGame();
}

// ========================
// ПОКАЗ СЛЕДУЮЩЕГО СООБЩЕНИЯ
// ========================
function showNextMessage(sceneId, messageIndex) {
    const scene = scenes[sceneId];
    if (!scene || scene.type !== "multi-page") return;
    
    if (messageIndex < scene.pages.length) {
        // Показываем следующее сообщение
        const messageDiv = addMessage(scene.pages[messageIndex]);
        
        typeMessage(scene.pages[messageIndex], messageDiv, 25, () => {
            gameState.currentMessageIndex = messageIndex;
            
            // Если это последнее сообщение - показываем выбор
            if (messageIndex === scene.pages.length - 1) {
                if (scene.onComplete?.nextScene) {
                    // Создаем слушатель для перехода
                    createFullscreenClickListenerForNext(scene.onComplete.nextScene);
                }
            } else {
                // Ждем следующего клика
                createFullscreenClickListener(sceneId, messageIndex + 1);
            }
        });
    }
}

// ========================
// СЛУШАТЕЛИ КЛИКОВ
// ========================
let fullscreenClickListener = null;

function createFullscreenClickListener(sceneId, nextMessageIndex) {
    removeFullscreenClickListener();
    
    fullscreenClickListener = () => {
        if (gameState.waitingForChoice) return; // Не реагируем, если есть кнопки
        
        stopCurrentAnimation();
        removeFullscreenClickListener();
        showNextMessage(sceneId, nextMessageIndex);
    };
    
    document.addEventListener('click', fullscreenClickListener);
}

function createFullscreenClickListenerForNext(nextSceneId) {
    removeFullscreenClickListener();
    
    fullscreenClickListener = () => {
        if (gameState.waitingForChoice) return;
        
        stopCurrentAnimation();
        removeFullscreenClickListener();
        loadScene(nextSceneId);
    };
    
    document.addEventListener('click', fullscreenClickListener);
}

function removeFullscreenClickListener() {
    if (fullscreenClickListener) {
        document.removeEventListener('click', fullscreenClickListener);
        fullscreenClickListener = null;
    }
}

// ========================
// ПЕРВАЯ СЦЕНА (КНОПКА СВЕТ)
// ========================
function showFirstScene() {
    const gameContainer = document.querySelector('.game-container');
    const bgElement = document.getElementById('background');
    const textContainer = document.querySelector('.text-container');
    const choicesContainer = document.getElementById('choices');
    
    if (bgElement) {
        bgElement.style.backgroundImage = "url('images/111.png')";
    }
    
    if (textContainer) textContainer.style.display = 'none';
    if (choicesContainer) choicesContainer.style.display = 'none';
    
    gameContainer.classList.add('first-scene');
    
    let existingButton = document.querySelector('.light-button-container');
    if (existingButton) existingButton.remove();
    
    const buttonContainer = document.createElement('div');
    buttonContainer.className = 'centered-button-container light-button-container';
    
    const lightButton = document.createElement('button');
    lightButton.className = 'light-button';
    lightButton.textContent = 'СВЕТ';
    
    lightButton.onclick = () => {
        stopCurrentAnimation();
        gameState.gameStarted = true;
        saveGame();
        
        buttonContainer.remove();
        
        if (textContainer) textContainer.style.display = 'flex';
        if (choicesContainer) choicesContainer.style.display = 'flex';
        gameContainer.classList.remove('first-scene');
        
        loadScene('after_light');
    };
    
    buttonContainer.appendChild(lightButton);
    gameContainer.appendChild(buttonContainer);
}

// ========================
// КОМАНДЫ ДЛЯ ОЧИСТКИ ЭКРАНА
// ========================

// 1. УДАЛЯЕТ ВСЕ СООБЩЕНИЯ
function clearAllMessages() {
    const wrapper = document.querySelector('.messages-wrapper');
    if (wrapper) {
        wrapper.innerHTML = '';  // Удаляет ВСЕ сообщения
    }
}

// 2. УДАЛЯЕТ ОТ ОПРЕДЕЛЕННОГО СООБЩЕНИЯ И ДО КОНЦА
function clearMessagesFromIndex(startIndex) {
    const wrapper = document.querySelector('.messages-wrapper');
    if (wrapper) {
        const messages = wrapper.querySelectorAll('.message');
        for (let i = startIndex; i < messages.length; i++) {
            messages[i].remove();
        }
    }
}

// ========================
// СЦЕНЫ
// ========================
const scenes = {
    "after_light": {
        type: "multi-page",
        background: "url('images/111.png')",
        pages: [
            "Свет...",
            "Его здесь нет",
            "Даже стекло на каком-то моменте заканчивается - само понятие стеклянности исчезает, оставляя смысловой вакуум",
            "Я бы сказал, даже категорический вакуум!",
            "Основополагающий вакуум",
            "Стекло, за которым нет ничего и присутствует всё одновременно..."
        ],
        onComplete: {
            nextScene: "exprmnt"
        }
    },
    
    "exprmnt": {
        type: "choice",
        background: "url('images/111.png')",
        text: "Но давай с тобой устроим мысленный эксперимент?",
        choices: [
            { 
                text: "Что за эксперимент?", 
                nextScene: "non",
                style: "mysterious",
                effect: () => {
                    clearMessagesFromIndex(3);
                },
            },
            { 
                text: "Давай", 
                nextScene: "non",
                style: "mysterious"
            },
            { 
                text: "Не надо", 
                nextScene: "non",
                style: "mysterious"
            }
        ]
    },

    "non": {
        type: "choice",
        background: "url('images/11.png')",
        text: "Эта страница пока что еще не готова. Прошу вас вернуться в самое начало)",
        choices: [
            { 
                text: "В начало", 
                nextScene: "after_light",
                style: "mysterious"
            }
        ]
    }
};

// ========================
// ЗАПУСК ИГРЫ
// ========================
document.addEventListener('DOMContentLoaded', () => {
    loadGame();
    
    setTimeout(() => {
        if (!gameState.gameStarted) {
            showFirstScene();
        } else {
            if (gameState.currentScene && scenes[gameState.currentScene]) {
                loadScene(gameState.currentScene);
            } else {
                gameState.gameStarted = false;
                showFirstScene();
            }
        }
    }, 100);
});
