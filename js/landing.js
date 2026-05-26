// landing.js - главная страница с Supabase

let authModal = null;
let isLoginMode = true;
let supabaseClient = null;
let currentUser = null;

const SUPABASE_URL = 'https://iftyzkwgzjlrbkegjwah.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_GqgcfnhpGiIbXxmUZLG6bA_x2DhoNEA';

// Инициализация Supabase
function initSupabase() {
    if (!supabaseClient && window.supabase) {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('✅ Supabase initialized');
    }
    return supabaseClient;
}

// ==================== ГЛОБАЛЬНЫЕ ФУНКЦИИ ====================

window.checkAuth = async () => {
    initSupabase();
    if (!supabaseClient) return null;
    
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return null;
    
    let subscriptionTier = 'free';
    let subscriptionExpires = null;
    
    try {
        const { data: profile, error } = await supabaseClient
            .from('profiles')
            .select('subscription_tier, subscription_expires')
            .eq('id', session.user.id)
            .maybeSingle();
        
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
    if (!supabaseClient) return { allowed: true };
    
    const MAX_FREE = 5;
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return { allowed: true };
    
    let isPro = false;
    try {
        const { data: profile } = await supabaseClient
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
    if (supabaseClient) {
        await supabaseClient.auth.signOut();
    }
    localStorage.clear();
    sessionStorage.clear();
    currentUser = null;
    window.location.href = '/';
};

// ==================== ФУНКЦИИ ДЛЯ ГЛАВНОЙ СТРАНИЦЫ ====================

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded');
    initSupabase();
    initCarousel();
    initAuthModal();
    initProModal();
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

function initProModal() {
    const proModal = document.getElementById('proModal');
    const proBtn = document.getElementById('proBtn');
    const closeBtns = document.querySelectorAll('.pro-close');
    
    if (!proModal || !proBtn) return;
    
    proBtn.onclick = () => {
        proModal.style.display = 'flex';
    };
    
    closeBtns.forEach(btn => {
        btn.onclick = () => {
            proModal.style.display = 'none';
        };
    });
    
    window.onclick = (e) => {
        if (e.target === proModal) proModal.style.display = 'none';
    };
    
    // Обработчики для кнопок подключения
    document.querySelectorAll('.btn-pro-select').forEach(btn => {
        btn.onclick = () => {
            if (currentUser) {
                alert(`Оплата тарифа ${btn.dataset.plan === 'month' ? '1 месяц (250 ₽)' : '6 месяцев (1000 ₽)'}\n\nПосле оплаты PRO активируется автоматически.\nСпособ оплаты: перевод на карту по ссылке, которую мы отправим на email.`);
                proModal.style.display = 'none';
            } else {
                alert('Сначала зарегистрируйтесь или войдите в аккаунт');
                proModal.style.display = 'none';
                if (authModal) authModal.style.display = 'flex';
            }
        };
    });
}

function initAuthModal() {
    authModal = document.getElementById('authModal');
    const authForm = document.getElementById('authForm');
    
    if (!authModal || !authForm) {
        console.log('Auth modal not found on this page');
        return;
    }
    
    // Закрытие
    const closeBtn = document.querySelector('.auth-close');
    if (closeBtn) {
        closeBtn.onclick = () => {
            authModal.style.display = 'none';
            const errorDiv = document.getElementById('authError');
            if (errorDiv) {
                errorDiv.style.display = 'none';
                errorDiv.className = 'auth-error';
            }
        };
    }
    
    window.onclick = (e) => {
        if (e.target === authModal) authModal.style.display = 'none';
    };
    
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
            if (privacyBlock) privacyBlock.style.display = 'flex';
        }
        
        const newLink = switchText.querySelector('.switch-link');
        if (newLink) {
            newLink.onclick = (e) => {
                e.preventDefault();
                isLoginMode = !isLoginMode;
                document.getElementById('authForm').reset();
                const errorDiv = document.getElementById('authError');
                if (errorDiv) {
                    errorDiv.style.display = 'none';
                    errorDiv.className = 'auth-error';
                }
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
        
        if (errorDiv) {
            errorDiv.style.display = 'none';
            errorDiv.className = 'auth-error';
        }
        
        if (!email || !password) {
            if (errorDiv) {
                errorDiv.textContent = 'Заполните все поля';
                errorDiv.style.display = 'block';
            }
            return;
        }
        
        if (!isLoginMode && privacyCheckbox && !privacyCheckbox.checked) {
            if (errorDiv) {
                errorDiv.textContent = 'Необходимо согласие с политикой обработки персональных данных';
                errorDiv.style.display = 'block';
            }
            return;
        }
        
        try {
            if (isLoginMode) {
                const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
                if (error) throw error;
                window.location.href = '/app.html';
            } else {
                const { error, data } = await supabaseClient.auth.signUp({
                    email,
                    password,
                    options: { emailRedirectTo: window.location.origin + '/app.html' }
                });
                
                if (error) throw error;
                
                if (errorDiv) {
                    errorDiv.textContent = '✅ Регистрация успешна! На вашу почту отправлено письмо для подтверждения. После подтверждения войдите в аккаунт.';
                    errorDiv.className = 'auth-success';
                    errorDiv.style.display = 'block';
                }
                
                document.getElementById('authForm').reset();
                if (privacyCheckbox) privacyCheckbox.checked = false;
                
                setTimeout(() => {
                    isLoginMode = true;
                    updateModalContent();
                    if (errorDiv) {
                        errorDiv.style.display = 'none';
                        errorDiv.className = 'auth-error';
                    }
                }, 3000);
            }
        } catch (err) {
            if (errorDiv) {
                errorDiv.textContent = err.message;
                errorDiv.className = 'auth-error';
                errorDiv.style.display = 'block';
            }
        }
    };
}

function initButtons() {
    const showModal = () => {
        if (authModal) authModal.style.display = 'flex';
    };
    
    const showModalWithMode = (mode) => {
        isLoginMode = mode;
        const title = document.getElementById('authModalTitle');
        const btn = document.getElementById('authSubmitBtn');
        const switchText = document.getElementById('authSwitchText');
        const privacyBlock = document.getElementById('privacyCheckbox');
        const errorDiv = document.getElementById('authError');
        
        if (errorDiv) {
            errorDiv.style.display = 'none';
            errorDiv.className = 'auth-error';
        }
        
        if (title) title.textContent = mode ? 'Вход в аккаунт' : 'Регистрация';
        if (btn) btn.textContent = mode ? 'Войти' : 'Зарегистрироваться';
        if (switchText) {
            switchText.innerHTML = mode 
                ? 'Нет аккаунта? <a href="#" class="switch-link">Зарегистрироваться</a>'
                : 'Уже есть аккаунт? <a href="#" class="switch-link">Войти</a>';
        }
        if (privacyBlock) privacyBlock.style.display = mode ? 'none' : 'flex';
        
        const newLink = switchText?.querySelector('.switch-link');
        if (newLink) {
            newLink.onclick = (e) => {
                e.preventDefault();
                showModalWithMode(!mode);
            };
        }
        
        showModal();
    };
    
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const startNowBtn = document.getElementById('startNowBtn');
    
    if (loginBtn) {
        loginBtn.onclick = () => showModalWithMode(true);
    }
    
    if (registerBtn) {
        registerBtn.onclick = () => {
            if (currentUser) {
                window.logout();
            } else {
                showModalWithMode(false);
            }
        };
    }
    
    if (startNowBtn) {
        startNowBtn.onclick = () => {
            if (currentUser) {
                window.location.href = '/app.html';
            } else {
                showModalWithMode(false);
            }
        };
    }
}

async function checkAuthStatus() {
    initSupabase();
    if (!supabaseClient) {
        setTimeout(checkAuthStatus, 500);
        return;
    }
    
    await window.checkAuth();
    
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const userInfoHeader = document.getElementById('userInfoHeader');
    const headerUserEmail = document.getElementById('headerUserEmail');
    
    if (currentUser && loginBtn && registerBtn) {
        loginBtn.style.display = 'none';
        registerBtn.textContent = 'Выйти';
        if (userInfoHeader) {
            userInfoHeader.style.display = 'flex';
            if (headerUserEmail) headerUserEmail.textContent = currentUser.email;
        }
    } else if (loginBtn && registerBtn) {
        loginBtn.style.display = 'inline-block';
        registerBtn.textContent = 'Регистрация';
        if (userInfoHeader) userInfoHeader.style.display = 'none';
    }
}

console.log('✅ Landing.js loaded');
