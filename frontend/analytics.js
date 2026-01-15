/**
 * Student Portal Analytics Tracker
 * Tracks user interactions, navigation, and behavior for Design Thinking evaluation
 */

class AnalyticsTracker {
    constructor(config = {}) {
        this.serverUrl = config.serverUrl || 'https://woxsen-app-student-backend.onrender.com';
        this.sessionId = this.getOrCreateSessionId();
        this.userId = config.userId || null;
        this.enabled = config.enabled !== false;
        this.events = [];
        this.sessionStartTime = Date.now();
        this.currentPage = window.location.pathname;
        this.debugMode = config.debugMode || false;

        if (this.enabled) {
            this.init();
        }
    }

    init() {
        this.log('Analytics tracker initialized', { sessionId: this.sessionId });

        // Check for participant info (from test-session-starter.html)
        this.checkParticipantInfo();

        // Track page view
        this.trackPageView();

        // Set up event listeners
        this.setupClickTracking();
        this.setupFormTracking();
        this.setupNavigationTracking();
        this.setupTimeTracking();

        // Send events periodically
        this.startPeriodicSync();

        // Send events before page unload
        window.addEventListener('beforeunload', () => {
            this.syncEvents(true);
        });
    }

    checkParticipantInfo() {
        const info = sessionStorage.getItem('participant_info');
        if (info && !sessionStorage.getItem('analytics_session_started')) {
            try {
                const participantData = JSON.parse(info);
                this.userId = participantData.participantId; // Link participant ID to all events
                this.trackEvent('session_start', {
                    participantId: participantData.participantId,
                    role: participantData.role,
                    ageRange: participantData.ageRange,
                    techProficiency: participantData.techProficiency,
                    firstTime: participantData.firstTime,
                    startTime: participantData.startTime
                });
                sessionStorage.setItem('analytics_session_started', 'true');
                this.log('Participant info tracked');
            } catch (e) {
                console.error('Error parsing participant info:', e);
            }
        }
    }

    getOrCreateSessionId() {
        let sessionId = sessionStorage.getItem('analytics_session_id');
        if (!sessionId) {
            sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            sessionStorage.setItem('analytics_session_id', sessionId);
            sessionStorage.setItem('analytics_session_start', Date.now());
        }
        return sessionId;
    }

    log(message, data = {}) {
        if (this.debugMode) {
            console.log(`[Analytics] ${message}`, data);
        }
    }

    trackEvent(eventType, eventData = {}) {
        if (!this.enabled) return;

        const event = {
            eventId: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            sessionId: this.sessionId,
            userId: this.userId,
            eventType,
            eventData,
            timestamp: new Date().toISOString(),
            url: window.location.href,
            pathname: window.location.pathname,
            userAgent: navigator.userAgent,
            screenResolution: `${window.screen.width}x${window.screen.height}`,
            viewportSize: `${window.innerWidth}x${window.innerHeight}`,
            timeOnPage: Date.now() - this.sessionStartTime
        };

        this.events.push(event);
        this.log(`Event tracked: ${eventType}`, event);

        // Auto-sync if buffer is getting large
        if (this.events.length >= 10) {
            this.syncEvents();
        }

        return event;
    }

    trackPageView() {
        this.trackEvent('page_view', {
            page: window.location.pathname,
            title: document.title,
            referrer: document.referrer
        });
    }

    setupClickTracking() {
        document.addEventListener('click', (e) => {
            const target = e.target;
            const tagName = target.tagName.toLowerCase();

            // Track all button clicks
            if (tagName === 'button' || target.closest('button')) {
                const button = tagName === 'button' ? target : target.closest('button');
                this.trackEvent('button_click', {
                    buttonText: button.textContent.trim(),
                    buttonId: button.id,
                    buttonClass: button.className,
                    dataView: button.getAttribute('data-view')
                });
            }

            // Track link clicks
            if (tagName === 'a' || target.closest('a')) {
                const link = tagName === 'a' ? target : target.closest('a');
                this.trackEvent('link_click', {
                    linkText: link.textContent.trim(),
                    linkHref: link.href,
                    linkId: link.id
                });
            }

            // Track clicks on cards/items
            if (target.closest('.card, .course-card, .assignment-card')) {
                const card = target.closest('.card, .course-card, .assignment-card');
                this.trackEvent('card_click', {
                    cardClass: card.className,
                    cardId: card.id
                });
            }

            // Track navigation clicks
            if (target.closest('.nav-btn')) {
                const navBtn = target.closest('.nav-btn');
                this.trackEvent('navigation_click', {
                    navText: navBtn.textContent.trim(),
                    navView: navBtn.getAttribute('data-view')
                });
            }
        }, true);
    }

    setupFormTracking() {
        // Track form submissions
        document.addEventListener('submit', (e) => {
            const form = e.target;
            this.trackEvent('form_submit', {
                formId: form.id,
                formAction: form.action,
                formMethod: form.method
            });
        }, true);

        // Track input focus (user interaction)
        document.addEventListener('focus', (e) => {
            const target = e.target;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
                this.trackEvent('input_focus', {
                    inputType: target.type,
                    inputId: target.id,
                    inputName: target.name
                });
            }
        }, true);

        // Track input changes
        document.addEventListener('change', (e) => {
            const target = e.target;
            if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
                this.trackEvent('input_change', {
                    inputType: target.type,
                    inputId: target.id,
                    inputName: target.name,
                    hasValue: !!target.value
                });
            }
        }, true);
    }

    setupNavigationTracking() {
        // Track view changes (for single-page app navigation)
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    const target = mutation.target;
                    if (target.classList && target.classList.contains('view') && target.classList.contains('active')) {
                        this.trackEvent('view_change', {
                            viewId: target.id,
                            viewName: target.id.replace('view-', '')
                        });
                    }
                }
            });
        });

        // Observe all view elements
        document.querySelectorAll('.view').forEach(view => {
            observer.observe(view, { attributes: true, attributeFilter: ['class'] });
        });

        // Track hash changes
        window.addEventListener('hashchange', () => {
            this.trackEvent('hash_change', {
                oldHash: this.currentHash,
                newHash: window.location.hash
            });
            this.currentHash = window.location.hash;
        });
    }

    setupTimeTracking() {
        // Track time spent on page
        setInterval(() => {
            this.trackEvent('time_on_page', {
                duration: Date.now() - this.sessionStartTime,
                durationFormatted: this.formatDuration(Date.now() - this.sessionStartTime)
            });
        }, 60000); // Every minute

        // Track scroll depth
        let maxScrollDepth = 0;
        window.addEventListener('scroll', () => {
            const scrollDepth = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
            if (scrollDepth > maxScrollDepth) {
                maxScrollDepth = scrollDepth;
                this.trackEvent('scroll_depth', {
                    depth: Math.round(scrollDepth),
                    scrollY: window.scrollY
                });
            }
        });
    }

    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    }

    startPeriodicSync() {
        // Sync events every 30 seconds
        setInterval(() => {
            if (this.events.length > 0) {
                this.syncEvents();
            }
        }, 30000);
    }

    async syncEvents(isBeforeUnload = false) {
        if (this.events.length === 0) return;

        const eventsToSync = [...this.events];
        this.events = []; // Clear buffer

        try {
            const payload = {
                sessionId: this.sessionId,
                userId: this.userId,
                events: eventsToSync
            };

            if (isBeforeUnload && navigator.sendBeacon) {
                // Use sendBeacon for reliable delivery during page unload
                navigator.sendBeacon(
                    `${this.serverUrl}/api/analytics/events`,
                    JSON.stringify(payload)
                );
            } else {
                const response = await fetch(`${this.serverUrl}/api/analytics/events`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    throw new Error('Failed to sync events');
                }

                this.log(`Synced ${eventsToSync.length} events`);
            }
        } catch (error) {
            console.error('Failed to sync analytics events:', error);
            // Re-add events to buffer if sync failed
            this.events.unshift(...eventsToSync);
        }
    }

    setUserId(userId) {
        this.userId = userId;
        this.log('User ID set', { userId });
    }

    trackCustomEvent(eventName, eventData = {}) {
        return this.trackEvent('custom', {
            customEventName: eventName,
            ...eventData
        });
    }

    getSessionInfo() {
        return {
            sessionId: this.sessionId,
            sessionStartTime: sessionStorage.getItem('analytics_session_start'),
            userId: this.userId,
            eventCount: this.events.length
        };
    }

    disable() {
        this.enabled = false;
        this.log('Analytics tracking disabled');
    }

    enable() {
        this.enabled = true;
        this.log('Analytics tracking enabled');
    }
}

// Global instance
if (typeof window !== 'undefined') {
    window.AnalyticsTracker = AnalyticsTracker;

    // Auto-initialize if not already initialized
    if (!window.analytics) {
        window.analytics = new AnalyticsTracker({
            debugMode: true, // Switched on for better debugging
            enabled: true
        });
    }
}
