// База данных пользователей
const USERS = {
    // Администратор - без ограничений
    'admin': {
        password: 'admin123',
        role: 'admin',
        expiresAt: null,
        displayName: 'Администратор'
    },
    // Полная версия
    'azs': {
        password: 'azs123',
        role: 'full',
        expiresAt: '2026-12-31',
        displayName: 'АЗС НефтеТрейд'
    },
    'logist': {
        password: 'logist2025',
        role: 'full',
        expiresAt: '2026-06-30',
        displayName: 'Логист'
    },
    // Демо-режим
    'demo': {
        password: 'demo',
        role: 'demo',
        expiresAt: null,
        displayName: 'Демо-режим'
    },
    'guest': {
        password: 'guest',
        role: 'demo',
        expiresAt: null,
        displayName: 'Гостевой доступ'
    }
};

// Элементы DOM
const goToAppBtn = document.getElementById('goToAppBtn');
const authModal = document.getElementById('authModal');
const privacyModal = document.getElementById('privacyModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelAuthBtn = document.getElementById('cancelAuthBtn');
const loginBtn = document.getElementById('loginBtn');
const demoBtn = document.getElementById('demoBtn');
const privacyPolicyBtn = document.getElementById('privacyPolicyBtn');
const closePrivacyModal = document.getElementById('closePrivacyModal');
const closePrivacyBtn = document.getElementById('closePrivacyBtn');
const loginInput = document.getElementById('loginInput');
const passwordInput = document.getElementById('passwordInput');
const authError = document.getElementById('authError');

// Функция проверки срока действия пароля
function isPasswordExpired(expiresAt) {
    if (!expiresAt) return false;
    const expireDate = new Date(expiresAt);
    const today = new Date();
    return today > expireDate;
}

// Функция проверки авторизации
function checkAuth(role = null) {
    let login, password, user;

    if (role === 'demo') {
        login = 'demo';
        password = 'demo';
        user = USERS['demo'];
    } else {
        login = loginInput.value.trim();
        password = passwordInput.value;
        user = USERS[login];
    }

    if (!user) {
        authError.textContent = 'Неверный логин или пароль';
        passwordInput.value = '';
        passwordInput.focus();
        return false;
    }

    if (user.password !== password) {
        authError.textContent = 'Неверный логин или пароль';
        passwordInput.value = '';
        passwordInput.focus();
        return false;
    }

    if (isPasswordExpired(user.expiresAt)) {
        authError.textContent = `Срок действия пароля истёк. Доступ был до ${user.expiresAt}`;
        passwordInput.value = '';
        passwordInput.focus();
        return false;
    }

    closeAuthModal();
    
    const userData = {
        login: login,
        role: user.role,
        displayName: user.displayName,
        expiresAt: user.expiresAt
    };
    sessionStorage.setItem('etrn_user', JSON.stringify(userData));
    
    window.location.href = 'app.html';
    return true;
}

// Функция открытия модального окна авторизации
function openAuthModal() {
    authModal.style.display = 'flex';
    loginInput.value = '';
    passwordInput.value = '';
    authError.textContent = '';
    setTimeout(() => loginInput.focus(), 100);
}

// Функция закрытия модального окна авторизации
function closeAuthModal() {
    authModal.style.display = 'none';
    authError.textContent = '';
}

// Функция открытия модального окна политики безопасности
function openPrivacyModal() {
    privacyModal.style.display = 'flex';
}

// Функция закрытия модального окна политики безопасности
function closePrivacyModalFunc() {
    privacyModal.style.display = 'none';
}

// Обработчик Enter в полях ввода
function handleKeyPress(e) {
    if (e.key === 'Enter') {
        checkAuth();
    }
}

// Дублирование содержимого XML для бесконечной прокрутки
function setupInfiniteScroll() {
    const xmlContainer = document.getElementById('scrollingXml');
    if (!xmlContainer) return;
    
    const originalContent = xmlContainer.innerHTML;
    xmlContainer.innerHTML = originalContent + originalContent;
}

// Анимация появления карточек при скролле
function setupScrollAnimation() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

    document.querySelectorAll('.feature-card, .step-card').forEach(el => {
        observer.observe(el);
    });
}

// Плавная остановка анимации при наведении на XML
function setupXmlHover() {
    const xmlWrapper = document.querySelector('.preview-xml-wrapper');
    const xmlContent = document.getElementById('scrollingXml');
    
    if (xmlWrapper && xmlContent) {
        xmlWrapper.addEventListener('mouseenter', () => {
            xmlContent.style.animationPlayState = 'paused';
        });
        
        xmlWrapper.addEventListener('mouseleave', () => {
            xmlContent.style.animationPlayState = 'running';
        });
    }
}

// Навешиваем обработчики
goToAppBtn.addEventListener('click', openAuthModal);
closeModalBtn.addEventListener('click', closeAuthModal);
cancelAuthBtn.addEventListener('click', closeAuthModal);
loginBtn.addEventListener('click', () => checkAuth());
if (demoBtn) demoBtn.addEventListener('click', () => checkAuth('demo'));
loginInput.addEventListener('keypress', handleKeyPress);
passwordInput.addEventListener('keypress', handleKeyPress);

// Обработчики для модального окна политики
if (privacyPolicyBtn) {
    privacyPolicyBtn.addEventListener('click', openPrivacyModal);
}
if (closePrivacyModal) {
    closePrivacyModal.addEventListener('click', closePrivacyModalFunc);
}
if (closePrivacyBtn) {
    closePrivacyBtn.addEventListener('click', closePrivacyModalFunc);
}

// Закрытие по клику вне модального окна
window.addEventListener('click', (e) => {
    if (e.target === authModal) {
        closeAuthModal();
    }
    if (e.target === privacyModal) {
        closePrivacyModalFunc();
    }
});

// Инициализация всех эффектов
document.addEventListener('DOMContentLoaded', () => {
    setupInfiniteScroll();
    setupScrollAnimation();
    setupXmlHover();
    
    const hero = document.querySelector('.hero');
    if (hero) hero.style.opacity = '1';
    
    // Добавляем эффект ripple для кнопок
    const buttons = document.querySelectorAll('.btn, .cta-button, .footer-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const ripple = document.createElement('span');
            ripple.classList.add('ripple');
            ripple.style.left = `${e.clientX - btn.offsetLeft}px`;
            ripple.style.top = `${e.clientY - btn.offsetTop}px`;
            btn.style.position = 'relative';
            btn.style.overflow = 'hidden';
            ripple.style.position = 'absolute';
            ripple.style.width = '100px';
            ripple.style.height = '100px';
            ripple.style.borderRadius = '50%';
            ripple.style.background = 'rgba(255,255,255,0.4)';
            ripple.style.transform = 'scale(0)';
            ripple.style.animation = 'ripple 0.6s linear';
            ripple.style.pointerEvents = 'none';
            btn.appendChild(ripple);
            setTimeout(() => ripple.remove(), 600);
        });
    });
});

// Добавляем стиль для ripple эффекта
const style = document.createElement('style');
style.textContent = `
    @keyframes ripple {
        to {
            transform: scale(4);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);