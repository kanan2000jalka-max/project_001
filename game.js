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
// ПРОПУСК АНИМАЦИИ (ПОКАЗАТЬ ВЕСЬ ТЕКСТ СРАЗУ)
// ========================
function skipAnimation(messageElement, fullText, callback = null) {
    // Сохраняем флаг, что анимация была, ДО ее остановки
    const hadAnimation = currentAnimation !== null;
    
    if (hadAnimation) {
        stopCurrentAnimation();  // Останавливаем текущую анимацию
    }
    
    if (messageElement && fullText) {
        // Показываем весь текст сразу
        messageElement.textContent = fullText;
        
        // Прокручиваем вниз
        const wrapper = document.querySelector('.messages-wrapper');
        if (wrapper) {
            wrapper.scrollTop = wrapper.scrollHeight;
        }

        // Удаляем data-атрибуты
        delete messageElement.dataset.fullText;
        delete messageElement.dataset.callback;
        delete messageElement._callback;
        
        // Вызываем callback, если есть
        if (callback) {
            setTimeout(callback, 10); // Небольшая задержка для гарантии
        }
    }
}

// ========================
// ПОБУКВЕННАЯ ПЕЧАТЬ СООБЩЕНИЯ
// ========================
function typeMessage(text, messageElement, speed = 10, callback = null) {
    stopCurrentAnimation();
    
    let index = 0;
    messageElement.textContent = '';

    // Сохраняем полный текст и callback в элементе для пропуска
    messageElement.dataset.fullText = text;
    messageElement.dataset.callback = callback ? 'true' : 'false';
    if (callback) {
        messageElement._callback = callback;  // Храним callback отдельно
    }
    
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
            delete messageElement.dataset.fullText;
            delete messageElement.dataset.callback;
            delete messageElement._callback;
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
        typeMessage(scene.text, messageDiv, 10, () => {
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
        
        typeMessage(scene.pages[messageIndex], messageDiv, 10, () => {
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

        // Проверяем, идет ли сейчас анимация
        if (currentAnimation) {
            // ПРОПУСКАЕМ АНИМАЦИЮ
            const currentMessage = document.querySelector('.message:last-child');
            if (currentMessage && currentMessage.dataset.fullText) {
                const fullText = currentMessage.dataset.fullText;
                const callback = currentMessage._callback;
                
                skipAnimation(currentMessage, fullText, callback);
                return; // Не переходим к следующей странице
            }
        }

        
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

        // Проверяем, идет ли сейчас анимация
        if (currentAnimation) {
            // ПРОПУСКАЕМ АНИМАЦИЮ
            const currentMessage = document.querySelector('.message:last-child');
            if (currentMessage && currentMessage.dataset.fullText) {
                const fullText = currentMessage.dataset.fullText;
                const callback = currentMessage._callback;
                
                skipAnimation(currentMessage, fullText, callback);
                return;
            }
        }
        
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
        
        loadScene('frst_mssg');
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
    "frst_mssg": {
        type: "multi-page",
        background: "url('images/111.png')",
        pages: [
            "Свет...",
            "Его здесь нет",
            "Даже стекло на каком-то моменте заканчивается", 
            "Само понятие стеклянности исчезает, оставляя смысловой вакуум",
            "Я бы сказал даже категорический вакуум!",
            "Основополагающий вакуум",
            "Стекло, за которым нет ничего и присутствует всё одновременно..."
        ],
        onComplete: {
            nextScene: "prlg_0.1"
        }
    },
//================================================================
    "prlg_0.1": {
        type: "choice",
        background: "url('images/111.png')",
        text: "Но давай с тобой устроим мысленный эксперимент?",
        choices: [
            { 
                text: "Что за эксперимент?", 
                nextScene: "prlg_0.1.1m",
                style: "mysterious"
                
            },
            { 
                text: "Давай", 
                nextScene: "prlg_0.2m",
                style: "mysterious"
            },
            { 
                text: "Не надо", 
                nextScene: "prlg_0.1.2",
                style: "mysterious",
                effect: () => {
                    clearAllMessages();
                }
            }
        ],
    },
    
    "prlg_0.1.1m": {
        type: "multi-page",
        background: "url('images/111.png')",
        pages: [
            "Попытка заглянуть за ширму!"
        ],
        onComplete: {
            nextScene: "prlg_0.1.1c"
        }
    },
    
    "prlg_0.1.1c": {
        type: "choice",
        background: "url('images/111.png')",
        text: "Попытка узнать, куда ведут все дороги и откуда начинает произрастать семя",
        choices: [
            { 
                text: "Интересно", 
                nextScene: "prlg_0.2m",
                style: "mysterious"
            }
        ]
    },
    
    "prlg_0.1.2": {
        type: "choice",
        background: "url('images/111.png')",
        text: "Да, действительно не надо. Не стоит открывать эту дверь)",
        choices: [
            { 
                text: "Выключить свет", 
                nextScene: "light_out",
                style: "mysterious",
                effect: () => {
                    clearAllMessages();
                }
            }
        ]
    },
//================================================================
    "prlg_0.2m": {
        type: "multi-page",
        background: "url('images/111.png')",
        pages: [ 
            "Отлично!",
            "Для этого нам понадобится целый спектр различных элементов!",
            "Начиная от отдельных операторов, передающих определенную сторону обрабатываемых данных, заканчивая средой, в которой объявленные операторы исполняют свои функции!", 
            "Запускаю вычислительную программу"
        ],
        onComplete: {
            nextScene: "prlg_0.2c"
        }      
    },

    "prlg_0.2c": {
        type: "choice",
        background: "url('images/111.png')",
        text: "Программа запущена. Если у вас будут вопросы, вы можете заняться декодированием среды. Это даст вам больше доступа к дополнительной информации",
        choices: [
            { 
                text: "Вывод:", 
                nextScene: "prlg_0.3",
                style: "mysterious"
            },
            { 
                text: "Дешифровка?", 
                nextScene: "prlg_0.2.2m",
                style: "mysterious",
                effect: () => {
                    clearAllMessages();
                }
            },
            { 
                text: "Я могу задать другие вопросы?", 
                nextScene: "prlg_0.2.3",
                style: "mysterious",
                effect: () => {
                    clearAllMessages();
                }
            }
        ]      
    },
//==========
    "prlg_0.2.2m": {
        type: "multi-page",
        background: "url('images/111.png')",
        pages: [
            "Вывод информации будет выражаться в текстовом описании и визуальных иллюстрациях.",
            "Но из-за оптимизирования бюджета, доступ к информации будет доступен только в определенном количестве. Это будет называться - общая информация.",
            "Для доступа к дополнительной информации, вы можете использовать дешифровку.",
            "С ее помощью у вас будет доступ к отдельным элементам среды, что может увеличить уровень интерпретации эксперимента."
        ],
        onComplete: {
            nextScene: "prlg_0.2.2c"
        }
    },
    
    "prlg_0.2.2c": {
        type: "choice",
        background: "url('images/111.png')",
        text: "Для удобства, будем называть процесс дешифровки: - изучение.",
        choices: [
            { 
                text: "То есть, я буду просто разглядывать разные вещи вокруг?", 
                nextScene: "prlg_0.2.2.1m",
                style: "mysterious"
            },
            { 
                text: "Что за интерпретация?", 
                nextScene: "prlg_0.2.2.2m",
                style: "mysterious"
            },
            { 
                text: "Понятно", 
                nextScene: "prlg_0.2.4",
                style: "mysterious"
            }
        ]
    },

    "prlg_0.2.2.1m": {
        type: "multi-page",
        background: "url('images/111.png')",
        pages: [
            "Как один из способов дешифровки.",
            "Технически, это визуализация описательного текста, но разница между способами воспиятия исключительно технологическая"
        ],
        onComplete: {
            nextScene: "prlg_0.2.2.1c"
        }
    },

    "prlg_0.2.2.2m": {
        type: "multi-page",
        background: "url('images/111.png')",
        pages: [
            "Эксперемен подразумевает путь от начала до конца",
            "Для прдвижения будет необходимо совершать определенные выборы, но не все выборы будуть приводить к продвижению",
            "Так как путь является неленейным, отдельные пути продвижения будут либо возвращать обратно, либо приводить к тупикам",
            "Но интерпритация - личное понимание, может открывать подсказки нужного направления для продвижения"
        ],
        onComplete: {
            nextScene: "prlg_0.2.2.2c"
        }
    },
    
    "prlg_0.2.2.1c": {
        type: "choice",
        background: "url('images/111.png')",
        text: "Все, так или иначе, преобразуется в сложную биохемическую реакцию внутри белкового вычислительного органа",
        choices: [
            { 
                text: "Понятно", 
                nextScene: "prlg_0.2.4",
                style: "mysterious"
            },
            { 
                text: "Я могу задать другие вопросы?", 
                nextScene: "prlg_0.2.3",
                style: "mysterious",
                effect: () => {
                    clearAllMessages();
                }
            }
        ]
    },
    
    "prlg_0.2.2.2c": {
        type: "choice",
        background: "url('images/111.png')",
        text: "Так что для успеха эксперемента важно изучать дополнительную информацию",
        choices: [
            { 
                text: "Понятно", 
                nextScene: "prlg_0.2.4",
                style: "mysterious"
            },
            { 
                text: "Я могу задать другие вопросы?", 
                nextScene: "prlg_0.2.3",
                style: "mysterious",
                effect: () => {
                    clearAllMessages();
                }
            }
        ]
    },
//==========    
    "prlg_0.2.3": {
        type: "choice",
        background: "url('images/111.png')",
        text: "Да, конечно! Надеюсь, доступные вопросы будут исчерпывающими для вас)",
        choices: [
            { 
                text: "Что за дешифорвка? ", 
                nextScene: "prlg_0.2.2m",
                style: "mysterious"
            },
            { 
                text: "Что за операторы?", 
                nextScene: "prlg_0.2.3.1m",
                style: "mysterious"
            },
            { 
                text: "Что за среда?", 
                nextScene: "prlg_0.2.3.2m",
                style: "mysterious"
            },
            { 
                text: "Я так и не понял, что за эксперемент?", 
                nextScene: "prlg_0.2.3.3m",
                style: "mysterious"
            },
            { 
                text: "А ты кто вообще такой???", 
                nextScene: "prlg_0.2.3.4m",
                style: "mysterious"
            },
        ]
    },

    "prlg_0.2.3.1m": {
        type: "multi-page",
        background: "url('images/111.png')",
        pages: [
            "Не что, а кто...",
            "Лучше не обращатся к ним, как к вещам. Это может провоцировать экзистенциальную тревогу.",
            "Операторы будут производить различные операции и каждый будет отвечать за разные стороны общего процесса"
        ],
        onComplete: {
            nextScene: "prlg_0.2.3.1c"
        }
    },

    "prlg_0.2.3.1c": {
        type: "choice",
        background: "url('images/111.png')",
        text: "При личном общении они смогут больше о себе рассказать",
        choices: [
            { 
                text: "Понятно", 
                nextScene: "prlg_0.2.4",
                style: "mysterious"
            },
            { 
                text: "Я могу задать другие вопросы?", 
                nextScene: "prlg_0.2.3",
                style: "mysterious",
                effect: () => {
                    clearAllMessages();
                }
            }
        ]
    },
    
    "prlg_0.2.3.2m": {
        type: "multi-page",
        background: "url('images/111.png')",
        pages: [
            "Самая простая и доступная, без излишеств. Обыкновенное пространство с различными поверхностями, сторонами и переходами между помещениями"
        ],
        onComplete: {
            nextScene: "prlg_0.2.3.2c"
        }
    },
    
    "prlg_0.2.3.2c": {
        type: "choice",
        background: "url('images/111.png')",
        text: "Ограниченное количевство ресурсов позволяет выражать только самое необходимое для комуникации операторов и их функцианированием, так как все остальное уходит на операцию",
        choices: [
            { 
                text: "Понятно", 
                nextScene: "prlg_0.2.4",
                style: "mysterious"
            },
            { 
                text: "Я могу задать другие вопросы?", 
                nextScene: "prlg_0.2.3",
                style: "mysterious",
                effect: () => {
                    clearAllMessages();
                }
            }
        ]
    },   
// =======================
//==---------???---------==
// =======================
    "prlg_0.2.3.3m": {
        type: "multi-page",
        background: "url('images/111.png')",
        pages: [
            "Что за эксперемент? (еще не написал)"
        ],
        onComplete: {
            nextScene: "prlg_0.2.3.3c"
        }
    },
//??????
    "prlg_0.2.3.3c": {
        type: "choice",
        background: "url('images/111.png')",
        text: "Что за эксперемент? (и это тоже не написал)",
        choices: [
            { 
                text: "Понятно", 
                nextScene: "prlg_0.2.4",
                style: "mysterious"
            },
            { 
                text: "Я могу задать другие вопросы?", 
                nextScene: "prlg_0.2.3",
                style: "mysterious",
                effect: () => {
                    clearAllMessages();
                }
            }
        ]
    },
// =======================
//==---------???---------==
// =======================

    

    "prlg_0.2.3.4m": {
        type: "multi-page",
        background: "url('images/111.png')",
        pages: [
            "Приятно познакомится!"
        ],
        onComplete: {
            nextScene: "prlg_0.2.3.4c"
        }
    },
    
    "prlg_0.2.3.4c": {
        type: "choice",
        background: "url('images/111.png')",
        text: "Я есть лишь промежуток между отдельными частями информации. Период между транслированием и считыванием информации является приблезительным, но предельно точным ответом на вопрос",
        choices: [
            { 
                text: "Понятно", 
                nextScene: "prlg_0.2.4",
                style: "mysterious"
            },
            { 
                text: "Я могу задать другие вопросы?", 
                nextScene: "prlg_0.2.3",
                style: "mysterious",
                effect: () => {
                    clearAllMessages();
                }
            }
        ]
    },
//==========
    "prlg_0.2.4": {
        type: "choice",
        background: "url('images/111.png')",
        text: "Отлично! Тогда вернемся к запуску программы",
        choices: [
            { 
                text: "Вывод:", 
                nextScene: "prlg_0.3",
                style: "mysterious"
            }
        ]
    },
//================================================================
    "prlg_0.3": {
        type: "multi-page",
        background: "url('images/111.png')",
        pages: [ 
            "Первое, что нам нужно, так это команда, для реализации проекта!",
            "Их досье будет лежать на столе",
            "Так же нам нужно будет устройство для операций, реализуемых в проекте",
            "Все остальное будет относится к дополнительной информации. Ее можно будет изучить отдельно",
            "Будет объявлена среда, внутри которой можно будет взаимодействовать с вышеописанными элементами",
        ],
        onComplete: {
            nextScene: "prlg_0.3.1"
        }      
    },    

        "prlg_0.3.1": {
        type: "choice",
        background: "url('images/111.png')",
        text: "Откройте глаза для старта взаимодействия",
        choices: [
            { 
                text: "Открыть глаза", 
                nextScene: "prlg_0.4",
                style: "mysterious"
            },
            { 
                text: "Что за команда?", 
                nextScene: "prlg_0.3.1",
                style: "mysterious",
                effect: () => {
                    clearAllMessages();
                }
            },
            { 
                text: "Что за устройство", 
                nextScene: "prlg_0.3.1",
                style: "mysterious",
                effect: () => {
                    clearAllMessages();
                }
            },
            { 
                text: "Что за дополнительная информация?", 
                nextScene: "prlg_0.3.1",
                style: "mysterious",
                effect: () => {
                    clearAllMessages();
                }
            },
            { 
                text: "Что за среда?", 
                nextScene: "prlg_0.3.1",
                style: "mysterious",
                effect: () => {
                    clearAllMessages();
                }
            }
        ]      
    },
//================================================================    
    "prlg_0.4": {
        type: "multi-page",
        background: "url('images/111.png')",
        pages: [ 
            "Врата глазных яблок открываются, улавливая скудный тусклый источник света в центре помещения.",
            "Узконаправленный свет ложится на старую мебель, окруженную устрашающим колличевством комуникаций.",
            "Оставшийся свет достается гудящей апаратуре, увесисто прижимающейся по краям стен.",
            "В дальнем конце можно углядеть металическую дверь",
            "Чувства не сразу дают о себе знать, но пространство постепенно наполняется присутсвием других фигур",
            "Пара пассивных тел, слившихся с мебелью,",
            "Кто то стоит у мерцающих экранов и чей то голос обращается к тебе..."
        ],
        onComplete: {
            nextScene: "prlg_0.4.1"
        }      
    },    

        "prlg_0.4.1": {
        type: "choice",
        background: "url('images/111.png')",
        text: "- Ты здесь?",
        choices: [
            { 
                text: "Кто?", 
                nextScene: "prlg_0.4.1",
                style: "mysterious",
                effect: () => {
                    clearAllMessages();
                }
            },
            { 
                text: "Где?", 
                nextScene: "prlg_0.4.1",
                style: "mysterious",
                effect: () => {
                    clearAllMessages();
                }
            },
            { 
                text: "Здесь", 
                nextScene: "backroom_0.1",
                style: "mysterious"
            },
            { 
                text: "Осмотреться", 
                nextScene: "prlg_0.4.1",
                style: "mysterious",
                effect: () => {
                    clearAllMessages();
                }
            }
        ]      
    },
    
// конец пролога. начало уровня за кулисами

        "backroom_0.1": {
        type: "choice",
        background: "url('images/111.png')",
        text: "- Отлично! Как будешь готов, можешь присоедениться к группе",
        choices: [
            { 
                text: "Ты кто?", 
                nextScene: "backroom_0.1",
                style: "mysterious",
                effect: () => {
                    clearAllMessages();
                }
            },
            { 
                text: "Что за группа?", 
                nextScene: "backroom_0.1",
                style: "mysterious",
                effect: () => {
                    clearAllMessages();
                }
            },
            { 
                text: "Стоп! Я вообще ничего не понимаю!", 
                nextScene: "backroom_0.1",
                style: "mysterious",
                effect: () => {
                    clearAllMessages();
                }
            },
            { 
                text: "Хорошо (Осмотреться)", 
                nextScene: "backroom_0.1",
                style: "mysterious",
                effect: () => {
                    clearAllMessages();
                }
            }
        ]      
    },

// технические сцены

    "light_out": {
        type: "choice",
        background: "url('images/11.png')",
        text: "Свет погас. Все погрузилось во мрак и стало ничем",
        choices: [
            { 
                text: "Включить свет", 
                nextScene: "frst_mssg",
                style: "mysterious",
                effect: () => {
                    clearAllMessages();
                }
            }
        ]
    }
// конец блока
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
