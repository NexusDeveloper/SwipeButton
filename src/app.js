(() => {
    function delayedCalling(callable, delay) {
        var timer = 0,
            savedContext,
            savedArguments;

        return function wrapper() {
            savedArguments = arguments;
            savedContext = this;

            clearTimeout(timer);

            timer = setTimeout(function () {
                callable.apply(savedContext, savedArguments);
            }, delay);
        };
    };


    /**
     * @param {Window|HTMLElement} elem
     * @param {string|string[]} events
     * @param {(e: Event) => void} listener
     * @param {boolean} [executeNow]
     * @returns {{unsubscribe: () => void}}
     */
    function subscribe(elem, events, listener, executeNow = false) {
        events = Array.isArray(events) ? events : [events];
        events.forEach(e => elem.addEventListener(e, listener));

        if (executeNow) {
            listener(null);
        }

        return {
            unsubscribe: () => {
                events.forEach(e => elem.removeEventListener(e, listener))
            }
        };
    }

    class SwipeButton {
        /**
         * @param {HTMLElement} node
         */
        constructor(node) {
            this.baseClassName = 'btn-swipe';

            this.node = node;
            this.options = {
                threshold: this.node.dataset.threshold || 150,
                metrikaId: this.node.dataset.metrikaId,
                metrikaGoalName: this.node.dataset.metrikaEvent,
            };

            /** @type {HTMLElement|null} */
            this.container = null;

            /** @type {HTMLElement|null} */
            this.link = null;

            /** @type {HTMLElement|null} */
            this.toggler = null;

            this.subscribtions = [];

            this.initialize();
        }

        /**
         * @returns {void}
         */
        initialize() {
            this.prepare();
            this.addEventListeners();
        }

        /**
         * @returns {void}
         */
        destroy() {
            this.removeEventListeners();

            this.container.remove();
            this.toggler.remove();

            this.container = null;
            this.toggler = null;
            this.link = null;

            this.node.style.display = '';
        }

        /**
         * @returns {void}
         */
        prepare() {
            const container = document.createElement('div');
            container.className = `${this.baseClassName}__container`;
            this.container = container;

            const wrapper = document.createElement('div');
            wrapper.className = `${this.baseClassName}__wrapper ${this.node.dataset.class}`;

            const note = document.createElement('div');
            note.className = `${this.baseClassName}__note`;
            note.textContent = this.getNote();

            const link = document.createElement('a');
            link.className = `${this.baseClassName}__link`;
            link.href = this.getTargetUrl();
            this.link = link;

            const toggler = document.createElement('span');
            toggler.className = `${this.baseClassName}__link__toggler`;
            this.toggler = toggler;

            const linkLabel = document.createElement('span');
            linkLabel.className = `${this.baseClassName}__link__label`;
            linkLabel.textContent = this.node.textContent;

            link.appendChild(toggler);
            link.appendChild(linkLabel);
            wrapper.appendChild(link);
            wrapper.appendChild(note);
            container.appendChild(wrapper);

            this.node.style.display = 'none';
            this.node.parentNode.insertBefore(container, this.node);
        }

        /**
         * @returns {void}
         */
        addEventListeners() {
            const onReachGoal = delayedCalling(this.fireSwitcherEvent.bind(this), 30);

            this.subscribtions.push(subscribe(this.link, 'click', e => {
                if (e.target.closest('a, button')) {
                    e.preventDefault();
                }
            }));

            let maxXCoordinate = 0;
            this.subscribtions.push(subscribe(window, 'resize', () => {
                maxXCoordinate = (
                    this.link.getBoundingClientRect().width -
                    this.toggler.getBoundingClientRect().width -
                    window.getComputedStyle(this.link).paddingRight.replace(/[^\d.,]+/guim, '') * 2
                );
            }, true));

            /**
             * @param {Event} e
             * @return {Event|Touch}
             */
            const getEvent = e => e instanceof TouchEvent ? e.changedTouches[0] : e;

            let isPressed = false, startedFromX = null;
            this.onLink(['mousedown', 'touchstart'], e => {
                e.stopPropagation();

                if (e.target.closest('a, button')) {
                    e.preventDefault();
                }

                if (isPressed || !e.target.closest('.' + this.toggler.className)) {
                    return;
                }

                isPressed = true;
                startedFromX = getEvent(e).clientX;
            });

            this.subscribtions.push(
                subscribe(document.documentElement, ['mousemove', 'touchmove'], e => {
                    e.stopPropagation();

                    if (!isPressed) {
                        return;
                    }

                    let newX = getEvent(e).clientX - startedFromX;
                    newX = Math.max(0, newX);
                    newX = Math.min(maxXCoordinate, newX);

                    this.toggler.style.left = newX + 'px';

                    if (newX === maxXCoordinate) {
                        isPressed = false;
                        this.toggler.style.left = '0px';
                        onReachGoal();
                    }
                })
            );

            this.subscribtions.push(
                subscribe(document.documentElement, ['mouseup', 'touchend'], e => {
                    if (!isPressed) {
                        return;
                    }

                    isPressed = false;
                    this.toggler.style.left = '0px';

                    if ((getEvent(e).clientX - startedFromX) >= this.options.threshold) {
                        onReachGoal();
                    }
                })
            );
        }

        /**
         * @returns {void}
         */
        removeEventListeners() {
            this.subscribtions.forEach(i => i.unsubscribe());
            this.subscribtions = [];
        }

        /**
         * @param {string|string[]} event
         * @param {(e: Event) => void} listener
         * @returns {{unsubscribe: () => void}}
         */
        onLink(event, listener) {
            const subscription = subscribe(this.link, event, listener);
            this.subscribtions.push(subscription);

            return subscription;
        }

        fireSwitcherEvent() {
            const url = this.getTargetUrl();
            if (!url) {
                return;
            }

            if (!('ym' in window) || !this.options.metrikaId) {
                location.href = url;

                return;
            }

            if (this.options.metrikaGoalName) {
                window.ym(this.options.metrikaId, 'reachGoal', this.options.metrikaGoalName);
            }

            window.ym(this.options.metrikaId, 'extLink', url, {
                callback: function () {
                    location.href = url;
                }
            });
        }

        /**
         * @return {string|undefined}
         */
        getTargetUrl() {
            return this.node.href;
        }

        /**
         * @return {string|undefined}
         */
        getNote() {
            return this.node.dataset.note;
        }
    }

    window.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('.btn-swipe').forEach(elem => {
            new SwipeButton(elem);
        });
    });
})();
