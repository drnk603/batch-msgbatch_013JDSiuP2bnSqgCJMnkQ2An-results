(function() {
  'use strict';

  const AppState = {
    initialized: false,
    burgerOpen: false,
    activeFilters: new Set(['all']),
    currentTestimonial: 0,
    stats: new Map()
  };

  const Config = {
    headerHeight: 80,
    animationDuration: 600,
    animationEasing: 'ease-in-out',
    debounceDelay: 150,
    throttleDelay: 100,
    intersectionThreshold: 0.15
  };

  const Patterns = {
    email: /^[^s@]+@[^s@]+.[^s@]+$/,
    phone: /^[ds+-()]{10,20}$/,
    name: /^[a-zA-ZÀ-ÿs-']{2,50}$/,
    message: /^.{10,}$/
  };

  const ValidationMessages = {
    name: 'Bitte geben Sie einen gültigen Namen ein (2-50 Zeichen)',
    email: 'Bitte geben Sie eine gültige E-Mail-Adresse ein',
    phone: 'Bitte geben Sie eine gültige Telefonnummer ein',
    message: 'Die Nachricht muss mindestens 10 Zeichen enthalten',
    privacy: 'Bitte akzeptieren Sie die Datenschutzerklärung',
    required: 'Dieses Feld ist erforderlich'
  };

  function debounce(fn, delay) {
    let timer = null;
    return function(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    };
  }

  function throttle(fn, limit) {
    let inThrottle = false;
    return function(...args) {
      if (!inThrottle) {
        fn.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  function sanitizeInput(input) {
    const div = document.createElement('div');
    div.textContent = input;
    return div.innerHTML;
  }

  class BurgerMenu {
    constructor() {
      this.nav = document.querySelector('.c-nav#main-nav');
      this.toggle = document.querySelector('.c-nav__toggle');
      this.navList = document.querySelector('.c-nav__list');
      this.body = document.body;
      
      if (!this.nav || !this.toggle || !this.navList) return;
      
      this.init();
    }

    init() {
      this.toggle.addEventListener('click', (e) => this.handleToggle(e));
      document.addEventListener('keydown', (e) => this.handleEscape(e));
      document.addEventListener('click', (e) => this.handleOutsideClick(e));
      
      const links = this.navList.querySelectorAll('.c-nav__link');
      links.forEach(link => {
        link.addEventListener('click', () => this.close());
      });

      window.addEventListener('resize', debounce(() => this.handleResize(), Config.debounceDelay));
    }

    handleToggle(e) {
      e.preventDefault();
      AppState.burgerOpen ? this.close() : this.open();
    }

    open() {
      this.nav.classList.add('is-open');
      this.toggle.setAttribute('aria-expanded', 'true');
      this.body.classList.add('u-no-scroll');
      AppState.burgerOpen = true;
      
      this.navList.style.height = `calc(100vh - ${Config.headerHeight}px)`;
      this.trapFocus();
    }

    close() {
      this.nav.classList.remove('is-open');
      this.toggle.setAttribute('aria-expanded', 'false');
      this.body.classList.remove('u-no-scroll');
      AppState.burgerOpen = false;
    }

    handleEscape(e) {
      if (e.key === 'Escape' && AppState.burgerOpen) {
        this.close();
      }
    }

    handleOutsideClick(e) {
      if (AppState.burgerOpen && !this.nav.contains(e.target) && e.target !== this.toggle) {
        this.close();
      }
    }

    handleResize() {
      if (window.innerWidth >= 1024 && AppState.burgerOpen) {
        this.close();
      }
    }

    trapFocus() {
      const focusableElements = this.navList.querySelectorAll(
        'a[href], button, textarea, input, select, [tabindex]:not([tabindex="-1"])'
      );
      const firstFocusable = focusableElements[0];
      const lastFocusable = focusableElements[focusableElements.length - 1];

      const handler = (e) => {
        if (e.key !== 'Tab') return;

        if (e.shiftKey) {
          if (document.activeElement === firstFocusable) {
            lastFocusable.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastFocusable) {
            firstFocusable.focus();
            e.preventDefault();
          }
        }
      };

      this.navList.addEventListener('keydown', handler);
    }
  }

  class SmoothScroll {
    constructor() {
      this.init();
    }

    init() {
      document.addEventListener('click', (e) => this.handleClick(e));
    }

    handleClick(e) {
      const target = e.target.closest('a[href^="#"]');
      if (!target) return;

      const href = target.getAttribute('href');
      if (!href || href === '#' || href === '#!') return;

      const sectionId = href.substring(1);
      const section = document.getElementById(sectionId);

      if (section) {
        e.preventDefault();
        this.scrollToSection(section);
      }
    }

    scrollToSection(section) {
      const header = document.querySelector('.l-header');
      const headerHeight = header ? header.offsetHeight : Config.headerHeight;
      const targetPosition = section.getBoundingClientRect().top + window.pageYOffset - headerHeight;

      window.scrollTo({
        top: targetPosition,
        behavior: 'smooth'
      });
    }
  }

  class ScrollSpy {
    constructor() {
      this.sections = document.querySelectorAll('[id]');
      this.navLinks = document.querySelectorAll('.c-nav__link[href^="#"]');
      
      if (!this.sections.length || !this.navLinks.length) return;
      
      this.init();
    }

    init() {
      const observer = new IntersectionObserver(
        (entries) => this.handleIntersection(entries),
        {
          threshold: 0.2,
          rootMargin: `-${Config.headerHeight}px 0px -60% 0px`
        }
      );

      this.sections.forEach(section => observer.observe(section));
    }

    handleIntersection(entries) {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.updateActiveLink(entry.target.id);
        }
      });
    }

    updateActiveLink(sectionId) {
      this.navLinks.forEach(link => {
        const href = link.getAttribute('href');
        if (href === `#${sectionId}`) {
          link.classList.add('is-active');
          link.setAttribute('aria-current', 'page');
        } else {
          link.classList.remove('is-active');
          link.removeAttribute('aria-current');
        }
      });
    }
  }

  class FormValidator {
    constructor() {
      this.forms = document.querySelectorAll('.c-form');
      if (!this.forms.length) return;
      
      this.init();
    }

    init() {
      this.forms.forEach(form => {
        form.addEventListener('submit', (e) => this.handleSubmit(e));
        
        const inputs = form.querySelectorAll('input, textarea, select');
        inputs.forEach(input => {
          input.addEventListener('blur', () => this.validateField(input));
        });
      });
    }

    handleSubmit(e) {
      e.preventDefault();
      e.stopPropagation();

      const form = e.target;
      const isValid = this.validateForm(form);

      if (!isValid) {
        this.showNotification('Bitte füllen Sie alle Pflichtfelder korrekt aus', 'danger');
        return;
      }

      this.submitForm(form);
    }

    validateForm(form) {
      const fields = form.querySelectorAll('[required], [data-validate]');
      let isValid = true;

      fields.forEach(field => {
        if (!this.validateField(field)) {
          isValid = false;
        }
      });

      return isValid;
    }

    validateField(field) {
      this.clearError(field);

      if (field.type === 'checkbox') {
        return this.validateCheckbox(field);
      }

      const value = field.value.trim();
      const name = field.name || field.id;

      if (field.required && !value) {
        this.showError(field, ValidationMessages.required);
        return false;
      }

      if (!value) return true;

      if (name.includes('name')) {
        return this.validatePattern(field, Patterns.name, ValidationMessages.name);
      }

      if (name.includes('email')) {
        return this.validatePattern(field, Patterns.email, ValidationMessages.email);
      }

      if (name.includes('phone') || field.type === 'tel') {
        return this.validatePattern(field, Patterns.phone, ValidationMessages.phone);
      }

      if (name.includes('message') || field.tagName === 'TEXTAREA') {
        return this.validatePattern(field, Patterns.message, ValidationMessages.message);
      }

      return true;
    }

    validateCheckbox(field) {
      if (field.required && !field.checked) {
        this.showError(field, ValidationMessages.privacy);
        return false;
      }
      return true;
    }

    validatePattern(field, pattern, message) {
      const value = field.value.trim();
      if (!pattern.test(value)) {
        this.showError(field, message);
        return false;
      }
      return true;
    }

    showError(field, message) {
      field.classList.add('has-error');
      
      let errorElement = field.parentElement.querySelector('.c-form__error');
      if (!errorElement) {
        errorElement = document.createElement('span');
        errorElement.className = 'c-form__error';
        field.parentElement.appendChild(errorElement);
      }
      
      errorElement.textContent = message;
      field.setAttribute('aria-invalid', 'true');
    }

    clearError(field) {
      field.classList.remove('has-error');
      field.removeAttribute('aria-invalid');
      
      const errorElement = field.parentElement.querySelector('.c-form__error');
      if (errorElement) {
        errorElement.remove();
      }
    }

    async submitForm(form) {
      const submitBtn = form.querySelector('[type="submit"]');
      if (!submitBtn) return;

      submitBtn.disabled = true;
      const originalText = submitBtn.innerHTML;
      submitBtn.innerHTML = '<span style="display:inline-block;width:16px;height:16px;border:2px solid currentColor;border-radius:50%;border-top-color:transparent;animation:spin 0.6s linear infinite;margin-right:8px;"></span>Wird gesendet...';

      const style = document.createElement('style');
      style.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
      document.head.appendChild(style);

      const formData = new FormData(form);
      const data = {};
      for (const [key, value] of formData.entries()) {
        data[key] = sanitizeInput(value);
      }

      try {
        await new Promise(resolve => setTimeout(resolve, 800));
        
        window.location.href = 'thank_you.html';
      } catch (error) {
        this.showNotification('Verbindungsfehler. Bitte versuchen Sie es später erneut.', 'danger');
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      } finally {
        style.remove();
      }
    }

    showNotification(message, type = 'info') {
      let container = document.getElementById('notification-container');
      if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        Object.assign(container.style, {
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: '9999',
          maxWidth: '400px'
        });
        document.body.appendChild(container);
      }

      const notification = document.createElement('div');
      notification.className = `notification notification--${type}`;
      Object.assign(notification.style, {
        background: type === 'danger' ? 'rgba(255,68,68,0.95)' : 'rgba(22,163,74,0.95)',
        color: '#fff',
        padding: '16px 24px',
        borderRadius: '10px',
        marginBottom: '12px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        backdropFilter: 'blur(10px)',
        animation: 'slideInRight 0.4s ease-out',
        border: `2px solid ${type === 'danger' ? '#ff4444' : '#16a34a'}`
      });
      notification.textContent = message;

      const styleSheet = document.createElement('style');
      styleSheet.textContent = '@keyframes slideInRight{from{transform:translateX(400px);opacity:0}to{transform:translateX(0);opacity:1}}';
      document.head.appendChild(styleSheet);

      container.appendChild(notification);

      setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.4s ease-out';
        styleSheet.textContent += '@keyframes slideOutRight{to{transform:translateX(400px);opacity:0}}';
        setTimeout(() => {
          notification.remove();
          if (!container.children.length) {
            container.remove();
          }
          styleSheet.remove();
        }, 400);
      }, 5000);
    }
  }

  class ScrollAnimations {
    constructor() {
      this.elements = document.querySelectorAll('img, .c-card, .c-service-card, .c-project-card, .c-testimonial, .c-testimonial-card, .c-video-card, .c-hero__content, .c-section__title, .c-section__subtitle, .c-guarantee-item, .c-quick-link, .c-case-study');
      
      if (!this.elements.length) return;
      
      this.init();
    }

    init() {
      const observer = new IntersectionObserver(
        (entries) => this.handleIntersection(entries),
        {
          threshold: Config.intersectionThreshold,
          rootMargin: '0px 0px -100px 0px'
        }
      );

      this.elements.forEach((el, index) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = `opacity ${Config.animationDuration}ms ${Config.animationEasing}, transform ${Config.animationDuration}ms ${Config.animationEasing}`;
        el.style.transitionDelay = `${index * 50}ms`;
        
        observer.observe(el);
      });
    }

    handleIntersection(entries) {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.opacity = '1';
          entry.target.style.transform = 'translateY(0)';
        }
      });
    }
  }

  class RippleEffect {
    constructor() {
      this.buttons = document.querySelectorAll('.c-button, .c-nav__link, .c-filter__btn, .c-quick-link, button');
      
      if (!this.buttons.length) return;
      
      this.init();
    }

    init() {
      this.buttons.forEach(btn => {
        btn.addEventListener('click', (e) => this.createRipple(e));
      });
    }

    createRipple(e) {
      const button = e.currentTarget;
      const rect = button.getBoundingClientRect();
      const ripple = document.createElement('span');
      
      const size = Math.max(rect.width, rect.height);
      const x = e.clientX - rect.left - size / 2;
      const y = e.clientY - rect.top - size / 2;

      Object.assign(ripple.style, {
        position: 'absolute',
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.5)',
        left: `${x}px`,
        top: `${y}px`,
        pointerEvents: 'none',
        transform: 'scale(0)',
        animation: 'ripple 0.6s ease-out',
        zIndex: '1'
      });

      if (!document.getElementById('ripple-styles')) {
        const style = document.createElement('style');
        style.id = 'ripple-styles';
        style.textContent = '@keyframes ripple{to{transform:scale(4);opacity:0}}';
        document.head.appendChild(style);
      }

      button.style.position = 'relative';
      button.style.overflow = 'hidden';
      button.appendChild(ripple);

      setTimeout(() => ripple.remove(), 600);
    }
  }

  class HoverAnimations {
    constructor() {
      this.cards = document.querySelectorAll('.c-card, .c-service-card, .c-project-card, .c-testimonial-card, .c-video-card, .c-guarantee-item, .c-quick-link, .c-case-study');
      
      if (!this.cards.length) return;
      
      this.init();
    }

    init() {
      this.cards.forEach(card => {
        card.addEventListener('mouseenter', () => this.handleMouseEnter(card));
        card.addEventListener('mouseleave', () => this.handleMouseLeave(card));
      });
    }

    handleMouseEnter(card) {
      card.style.transition = `all ${Config.animationDuration * 0.5}ms ${Config.animationEasing}`;
      card.style.transform = 'translateY(-8px) scale(1.02)';
    }

    handleMouseLeave(card) {
      card.style.transform = 'translateY(0) scale(1)';
    }
  }

  class CountUpAnimation {
    constructor() {
      this.stats = document.querySelectorAll('[data-count]');
      
      if (!this.stats.length) return;
      
      this.init();
    }

    init() {
      const observer = new IntersectionObserver(
        (entries) => this.handleIntersection(entries),
        { threshold: 0.5 }
      );

      this.stats.forEach(stat => observer.observe(stat));
    }

    handleIntersection(entries) {
      entries.forEach(entry => {
        if (entry.isIntersecting && !AppState.stats.has(entry.target)) {
          AppState.stats.set(entry.target, true);
          this.animateCount(entry.target);
        }
      });
    }

    animateCount(element) {
      const target = parseInt(element.getAttribute('data-count'));
      const duration = 2000;
      const step = target / (duration / 16);
      let current = 0;

      const timer = setInterval(() => {
        current += step;
        if (current >= target) {
          element.textContent = target;
          clearInterval(timer);
        } else {
          element.textContent = Math.floor(current);
        }
      }, 16);
    }
  }

  class PortfolioFilter {
    constructor() {
      this.filterButtons = document.querySelectorAll('.c-filter__btn');
      this.projectCards = document.querySelectorAll('.c-project-card');
      
      if (!this.filterButtons.length || !this.projectCards.length) return;
      
      this.init();
    }

    init() {
      this.filterButtons.forEach(btn => {
        btn.addEventListener('click', () => this.handleFilter(btn));
      });
    }

    handleFilter(button) {
      const filter = button.getAttribute('data-filter');
      
      this.filterButtons.forEach(btn => btn.classList.remove('is-active'));
      button.classList.add('is-active');

      this.projectCards.forEach((card, index) => {
        const category = card.getAttribute('data-category');
        
        if (filter === 'all' || category === filter) {
          card.style.animation = `fadeIn ${Config.animationDuration}ms ${Config.animationEasing} ${index * 50}ms both`;
          card.style.display = 'block';
        } else {
          card.style.animation = `fadeOut ${Config.animationDuration * 0.5}ms ${Config.animationEasing} both`;
          setTimeout(() => {
            card.style.display = 'none';
          }, Config.animationDuration * 0.5);
        }
      });

      if (!document.getElementById('filter-animations')) {
        const style = document.createElement('style');
        style.id = 'filter-animations';
        style.textContent = `
          @keyframes fadeIn{from{opacity:0;transform:scale(0.9)}to{opacity:1;transform:scale(1)}}
          @keyframes fadeOut{to{opacity:0;transform:scale(0.9)}}
        `;
        document.head.appendChild(style);
      }
    }
  }

  class CookieBanner {
    constructor() {
      this.banner = document.querySelector('.c-cookie-banner');
      this.acceptBtn = document.getElementById('cookie-accept');
      this.declineBtn = document.getElementById('cookie-decline');
      
      if (!this.banner) return;
      
      this.init();
    }

    init() {
      const consent = localStorage.getItem('cookie-consent');
      
      if (!consent) {
        setTimeout(() => {
          this.banner.classList.add('is-visible');
        }, 1000);
      }

      if (this.acceptBtn) {
        this.acceptBtn.addEventListener('click', () => this.accept());
      }

      if (this.declineBtn) {
        this.declineBtn.addEventListener('click', () => this.decline());
      }
    }

    accept() {
      localStorage.setItem('cookie-consent', 'accepted');
      this.hide();
    }

    decline() {
      localStorage.setItem('cookie-consent', 'declined');
      this.hide();
    }

    hide() {
      this.banner.style.animation = 'slideDown 0.5s ease-out reverse';
      setTimeout(() => {
        this.banner.classList.remove('is-visible');
      }, 500);
    }
  }

  class ScrollToTop {
    constructor() {
      this.createButton();
      this.init();
    }

    createButton() {
      this.button = document.createElement('button');
      this.button.className = 'c-scroll-top';
      this.button.setAttribute('aria-label', 'Nach oben scrollen');
      this.button.innerHTML = '↑';
      
      Object.assign(this.button.style, {
        position: 'fixed',
        bottom: '30px',
        right: '30px',
        width: '50px',
        height: '50px',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, var(--color-blush), var(--color-blush-dark))',
        color: '#fff',
        border: '2px solid var(--color-blush)',
        fontSize: '24px',
        cursor: 'pointer',
        opacity: '0',
        transform: 'translateY(100px)',
        transition: 'all 0.3s ease-in-out',
        zIndex: '1000',
        boxShadow: '0 0 20px rgba(255,107,157,0.6)'
      });

      document.body.appendChild(this.button);
    }

    init() {
      window.addEventListener('scroll', throttle(() => this.handleScroll(), Config.throttleDelay));
      this.button.addEventListener('click', () => this.scrollToTop());
    }

    handleScroll() {
      if (window.pageYOffset > 300) {
        this.button.style.opacity = '1';
        this.button.style.transform = 'translateY(0)';
      } else {
        this.button.style.opacity = '0';
        this.button.style.transform = 'translateY(100px)';
      }
    }

    scrollToTop() {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
  }

  class ImageLoader {
    constructor() {
      this.images = document.querySelectorAll('img');
      
      if (!this.images.length) return;
      
      this.init();
    }

    init() {
      this.images.forEach(img => {
        if (!img.hasAttribute('loading')) {
          img.setAttribute('loading', 'lazy');
        }

        img.addEventListener('error', (e) => this.handleError(e));
      });
    }

    handleError(e) {
      const img = e.target;
      const svg = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300"%3E%3Crect fill="%23e0e0e0" width="400" height="300"/%3E%3Ctext x="50%25" y="50%25" fill="%23999" font-family="sans-serif" font-size="18" text-anchor="middle" dominant-baseline="middle"%3EBild nicht verfügbar%3C/text%3E%3C/svg%3E';
      img.src = svg;
      img.style.objectFit = 'contain';
    }
  }

  class FAQSearch {
    constructor() {
      this.searchInput = document.getElementById('faq-search');
      this.accordionItems = document.querySelectorAll('.accordion-item');
      
      if (!this.searchInput || !this.accordionItems.length) return;
      
      this.init();
    }

    init() {
      this.searchInput.addEventListener('input', debounce((e) => this.handleSearch(e), 300));
    }

    handleSearch(e) {
      const query = e.target.value.toLowerCase().trim();

      this.accordionItems.forEach(item => {
        const text = item.textContent.toLowerCase();
        
        if (!query || text.includes(query)) {
          item.style.display = 'block';
          item.style.animation = 'fadeIn 0.3s ease-out';
        } else {
          item.style.display = 'none';
        }
      });
    }
  }

  class App {
    constructor() {
      if (AppState.initialized) return;
      AppState.initialized = true;
      
      this.init();
    }

    init() {
      new BurgerMenu();
      new SmoothScroll();
      new ScrollSpy();
      new FormValidator();
      new ScrollAnimations();
      new RippleEffect();
      new HoverAnimations();
      new CountUpAnimation();
      new PortfolioFilter();
      new CookieBanner();
      new ScrollToTop();
      new ImageLoader();
      new FAQSearch();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new App());
  } else {
    new App();
  }

})();
