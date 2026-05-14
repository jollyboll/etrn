// landing.js - главная страница с Supabase

let authModal = null;
let isLoginMode = true;
let sb = null;
let currentUser = null;

const SUPABASE_URL = 'https://iftyzkwgzjlrbkegjwah.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_GqgcfnhpGiIbXxmUZLG6bA_x2DhoNEA';

// Инициализация Supabase
function initSupabase() {
    if (!sb && window.supabase) {
        sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('✅ Supabase initialized');
    }
    return sb;
}

// ==================== ГЛОБАЛЬНЫЕ ФУНКЦИИ ====================

window.checkAuth = async () => {
    initSupabase();
    if (!sb) return null;
    
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return null;
    
    // Исправляем запрос - убираем .single() если нет записи
    let subscriptionTier = 'free';
    let subscriptionExpires = null;
    
    try {
        const { data: profile, error } = await sb
            .from('profiles')
            .select('subscription_tier, subscription_expires')
            .eq('id', session.user.id)
            .maybeSingle();  // Используем maybeSingle вместо single
        
        if (profile && !error) {
            subscriptionTier = profile.subscription_tier || 'free';
            subscriptionExpires = profile.subscription_expires;
        }
    } catch (err) {
        console.warn('Profile not found, using defaults');
    }
    
    currentUser = {
        id: session.user.id,
        email: session.user.email,
        subscription_tier: subscriptionTier,
        subscription_expires: subscriptionExpires
    };
    
    return currentUser;
};

window.checkLimit = async (category, currentCount) => {
    initSupabase();
    if (!sb) return { allowed: true };
    
    const MAX_FREE = 5;
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return { allowed: true };
    
    let isPro = false;
    try {
        const { data: profile } = await sb
            .from('profiles')
            .select('subscription_tier')
            .eq('id', session.user.id)
            .maybeSingle();
        isPro = profile?.subscription_tier === 'pro';
    } catch (err) {
        isPro = false;
    }
    
    if (isPro) {
        return { allowed: true };
    }
    
    if (currentCount >= MAX_FREE) {
        return {
            allowed: false,
            message: `Бесплатный тариф: максимум ${MAX_FREE} записей в категории. Перейдите на PRO.`
        };
    }
    
    return { allowed: true };
};

window.logout = async () => {
    initSupabase();
    if (sb) {
        await sb.auth.signOut();
    }
    localStorage.clear();
    sessionStorage.clear();
    currentUser = null;
    window.location.href = '/etrn/';
};

// ==================== ФУНКЦИИ ДЛЯ ГЛАВНОЙ СТРАНИЦЫ ====================

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded');
    initSupabase();
    initCarousel();
    initAuthModal();
    initButtons();
    checkAuthStatus();
});

function initCarousel() {
    const slides = document.querySelectorAll('.carousel-slide');
    const dots = document.querySelectorAll('.dot');
    if (!slides.length) return;
    
    let currentSlide = 0;
    let interval;
    
    function showSlide(index) {
        slides.forEach((s, i) => s.classList.toggle('active', i === index));
        dots.forEach((d, i) => d.classList.toggle('active', i === index));
        currentSlide = index;
    }
    
    function nextSlide() { showSlide((currentSlide + 1) % slides.length); }
    
    function startCarousel() {
        if (interval) clearInterval(interval);
        interval = setInterval(nextSlide, 5000);
    }
    
    dots.forEach((dot, i) => {
        dot.addEventListener('click', () => { showSlide(i); startCarousel(); });
    });
    
    startCarousel();
}

function initAuthModal() {
    authModal = document.getElementById('authModal');
    const authForm = document.getElementById('authForm');
    
    // Проверяем, что модальное окно существует на этой странице
    if (!authModal || !authForm) {
        console.log('Auth modal not found on this page (expected on landing page only)');
        return;
    }
    
    // Закрытие
    const closeBtn = document.querySelector('.auth-close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            authModal.style.display = 'none';
        });
    }
    
    window.addEventListener('click', (e) => {
        if (e.target === authModal) authModal.style.display = 'none';
    });
    
    function updateModalContent() {
        const title = document.getElementById('authModalTitle');
        const btn = document.getElementById('authSubmitBtn');
        const switchText = document.getElementById('authSwitchText');
        const privacyBlock = document.getElementById('privacyCheckbox');
        
        if (!title || !btn || !switchText) return;
        
        if (isLoginMode) {
            title.textContent = 'Вход в аккаунт';
            btn.textContent = 'Войти';
            switchText.innerHTML = 'Нет аккаунта? <a href="#" class="switch-link">Зарегистрироваться</a>';
            if (privacyBlock) privacyBlock.style.display = 'none';
        } else {
            title.textContent = 'Регистрация';
            btn.textContent = 'Зарегистрироваться';
            switchText.innerHTML = 'Уже есть аккаунт? <a href="#" class="switch-link">Войти</a>';
            if (privacyBlock) privacyBlock.style.display = 'block';
        }
        
        const newLink = switchText.querySelector('.switch-link');
        if (newLink) {
            newLink.onclick = (e) => {
                e.preventDefault();
                isLoginMode = !isLoginMode;
                updateModalContent();
            };
        }
    }
    
    updateModalContent();
    
    authForm.onsubmit = async (e) => {
        e.preventDefault();
        
        const email = document.getElementById('authEmail').value;
        const password = document.getElementById('authPassword').value;
        const privacyCheckbox = document.getElementById('privacyConsent');
        const errorDiv = document.getElementById('authError');
        
        if (!email || !password) {
            if (errorDiv) {
                errorDiv.textContent = 'Заполните все поля';
                errorDiv.style.display = 'block';
            }
            return;
        }
        
        if (!isLoginMode && privacyCheckbox && !privacyCheckbox.checked) {
            if (errorDiv) {
                errorDiv.textContent = 'Необходимо согласие с политикой безопасности';
                errorDiv.style.display = 'block';
            }
            return;
        }
        
        if (errorDiv) errorDiv.style.display = 'none';
        
        try {
            if (isLoginMode) {
                const { error } = await sb.auth.signInWithPassword({ email, password });
                if (error) throw error;
                window.location.href = './app.html';
            } else {
                const { error } = await sb.auth.signUp({
                    email,
                    password,
                    options: { emailRedirectTo: window.location.origin + './app.html' }
                });
                if (error) throw error;
                
                if (errorDiv) {
                    errorDiv.textContent = 'Регистрация успешна! Теперь войдите.';
                    errorDiv.style.color = '#4caf50';
                    errorDiv.style.display = 'block';
                }
                
                setTimeout(() => {
                    isLoginMode = true;
                    updateModalContent();
                    document.getElementById('authForm').reset();
                    if (errorDiv) errorDiv.style.display = 'none';
                }, 2000);
            }
        } catch (err) {
            if (errorDiv) {
                errorDiv.textContent = err.message;
                errorDiv.style.color = '#f44336';
                errorDiv.style.display = 'block';
            }
        }
    };
}

function initButtons() {
    const showModal = () => {
        if (authModal) authModal.style.display = 'flex';
    };
    
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const startNowBtn = document.getElementById('startNowBtn');
    const ctaRegisterBtn = document.getElementById('ctaRegisterBtn');
    
    if (loginBtn) {
        loginBtn.addEventListener('click', () => {
            isLoginMode = true;
            showModal();
        });
    }
    
    if (registerBtn) {
        registerBtn.addEventListener('click', () => {
            if (currentUser) {
                window.logout();
            } else {
                isLoginMode = false;
                showModal();
            }
        });
    }
    
    if (startNowBtn) {
        startNowBtn.addEventListener('click', () => {
            if (currentUser) {
                window.location.href = '/app.html';
            } else {
                isLoginMode = false;
                showModal();
            }
        });
    }
    
    if (ctaRegisterBtn) {
        ctaRegisterBtn.addEventListener('click', () => {
            if (currentUser) {
                window.location.href = '/app.html';
            } else {
                isLoginMode = false;
                showModal();
            }
        });
    }
    
    document.querySelectorAll('.pricing-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            alert('ПРО версия: неограниченное количество контрагентов. Свяжитесь: pro@neftetrade.ru');
        });
    });
}

async function checkAuthStatus() {
    initSupabase();
    if (!sb) {
        setTimeout(checkAuthStatus, 500);
        return;
    }
    
    await window.checkAuth();
    
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    
    if (currentUser && loginBtn && registerBtn) {
        loginBtn.style.display = 'none';
        registerBtn.textContent = 'Выйти';
    }
}

console.log('✅ Landing.js loaded');
