(function () {
    'use strict';

    // Check if Lampa is available
    if (typeof Lampa === 'undefined') {
        console.error('Watchlist plugin: Lampa is not defined');
        return;
    }

    // Prevent double initialization
    if (window.watchlist_plugin_loaded) return;
    window.watchlist_plugin_loaded = true;

    // ============================================
    // WATCHLIST PLUGIN FOR LAMPA
    // Allows users to manage a "To Watch" / "Watched" list
    // with impressions (liked, ok, disliked)
    // ============================================

    var STORAGE_KEY = 'watchlist_plugin_data';
    var STORAGE_VERSION = 1;

    // ============================================
    // STORAGE MODULE
    // ============================================
    var WatchlistStorage = {
        getData: function () {
            var data = Lampa.Storage.get(STORAGE_KEY, {
                version: STORAGE_VERSION,
                items: []
            });
            return data;
        },

        saveData: function (data) {
            Lampa.Storage.set(STORAGE_KEY, data);
        },

        generateId: function (card) {
            var type = card.media_type || (card.name ? 'tv' : 'movie');
            return 'tmdb_' + type + '_' + card.id;
        },

        findItem: function (id) {
            var data = this.getData();
            return data.items.find(function (item) {
                return item.id === id;
            });
        },

        findByTmdbId: function (tmdbId, mediaType) {
            var id = 'tmdb_' + mediaType + '_' + tmdbId;
            return this.findItem(id);
        },

        addItem: function (card) {
            var data = this.getData();
            var type = card.media_type || (card.name ? 'tv' : 'movie');
            var id = this.generateId(card);

            // Check if already exists
            if (this.findItem(id)) {
                return false;
            }

            var item = {
                id: id,
                tmdb_id: card.id,
                media_type: type,
                title: card.title || card.name,
                original_title: card.original_title || card.original_name,
                poster_path: card.poster_path,
                backdrop_path: card.backdrop_path,
                vote_average: card.vote_average,
                release_date: card.release_date || card.first_air_date,
                overview: card.overview,
                watched: false,
                impression: null,
                added_at: new Date().toISOString(),
                watched_at: null
            };

            data.items.push(item);
            this.saveData(data);
            return true;
        },

        removeItem: function (id) {
            var data = this.getData();
            var index = data.items.findIndex(function (item) {
                return item.id === id;
            });

            if (index !== -1) {
                data.items.splice(index, 1);
                this.saveData(data);
                return true;
            }
            return false;
        },

        markWatched: function (id, impression) {
            var data = this.getData();
            var item = data.items.find(function (i) {
                return i.id === id;
            });

            if (item) {
                item.watched = true;
                item.impression = impression;
                item.watched_at = new Date().toISOString();
                this.saveData(data);
                return true;
            }
            return false;
        },

        markUnwatched: function (id) {
            var data = this.getData();
            var item = data.items.find(function (i) {
                return i.id === id;
            });

            if (item) {
                item.watched = false;
                item.impression = null;
                item.watched_at = null;
                this.saveData(data);
                return true;
            }
            return false;
        },

        getToWatch: function () {
            var data = this.getData();
            return data.items.filter(function (item) {
                return !item.watched;
            }).sort(function (a, b) {
                return new Date(b.added_at) - new Date(a.added_at);
            });
        },

        getWatched: function () {
            var data = this.getData();
            return data.items.filter(function (item) {
                return item.watched;
            }).sort(function (a, b) {
                return new Date(b.watched_at) - new Date(a.watched_at);
            });
        },

        getByImpression: function (impression) {
            var data = this.getData();
            return data.items.filter(function (item) {
                return item.watched && item.impression === impression;
            }).sort(function (a, b) {
                return new Date(b.watched_at) - new Date(a.watched_at);
            });
        },

        isInWatchlist: function (tmdbId, mediaType) {
            return !!this.findByTmdbId(tmdbId, mediaType);
        },

        getStats: function () {
            var data = this.getData();
            var toWatch = 0;
            var watched = 0;
            var liked = 0;
            var ok = 0;
            var disliked = 0;

            data.items.forEach(function (item) {
                if (item.watched) {
                    watched++;
                    if (item.impression === 'liked') liked++;
                    else if (item.impression === 'ok') ok++;
                    else if (item.impression === 'disliked') disliked++;
                } else {
                    toWatch++;
                }
            });

            return {
                total: data.items.length,
                toWatch: toWatch,
                watched: watched,
                liked: liked,
                ok: ok,
                disliked: disliked
            };
        }
    };

    // ============================================
    // TEMPLATES
    // ============================================
    var Templates = {
        main: function () {
            return '\
                <div class="watchlist-plugin">\
                    <div class="watchlist-tabs selector">\
                        <div class="watchlist-tab selector active" data-tab="towatch">\
                            <span>К просмотру</span>\
                            <span class="watchlist-tab__count towatch-count">0</span>\
                        </div>\
                        <div class="watchlist-tab selector" data-tab="watched">\
                            <span>Просмотрено</span>\
                            <span class="watchlist-tab__count watched-count">0</span>\
                        </div>\
                    </div>\
                    <div class="watchlist-subtabs" style="display: none;">\
                        <div class="watchlist-subtab selector active" data-filter="all">\
                            <span>Все</span>\
                        </div>\
                        <div class="watchlist-subtab selector" data-filter="liked">\
                            <span>👍 Понравилось</span>\
                        </div>\
                        <div class="watchlist-subtab selector" data-filter="ok">\
                            <span>👌 На разок</span>\
                        </div>\
                        <div class="watchlist-subtab selector" data-filter="disliked">\
                            <span>👎 Фигня</span>\
                        </div>\
                    </div>\
                    <div class="watchlist-content">\
                        <div class="watchlist-items category-full"></div>\
                        <div class="watchlist-empty" style="display: none;">\
                            <div class="watchlist-empty__text">Список пуст</div>\
                        </div>\
                    </div>\
                </div>\
            ';
        },

        impressionModal: function () {
            return '\
                <div class="watchlist-impression-modal">\
                    <div class="watchlist-impression-modal__title">Как вам?</div>\
                    <div class="watchlist-impression-modal__options">\
                        <div class="watchlist-impression-option selector" data-impression="liked">\
                            <div class="watchlist-impression-option__icon">👍</div>\
                            <div class="watchlist-impression-option__text">Понравилось</div>\
                        </div>\
                        <div class="watchlist-impression-option selector" data-impression="ok">\
                            <div class="watchlist-impression-option__icon">👌</div>\
                            <div class="watchlist-impression-option__text">На разок</div>\
                        </div>\
                        <div class="watchlist-impression-option selector" data-impression="disliked">\
                            <div class="watchlist-impression-option__icon">👎</div>\
                            <div class="watchlist-impression-option__text">Фигня</div>\
                        </div>\
                    </div>\
                </div>\
            ';
        },

        style: function () {
            return '\
                <style>\
                .watchlist-plugin { padding: 1.5em; }\
                .watchlist-tabs { display: flex; gap: 1em; margin-bottom: 1em; }\
                .watchlist-tab { \
                    padding: 0.7em 1.5em; \
                    background: rgba(255,255,255,0.1); \
                    border-radius: 0.5em; \
                    display: flex; \
                    align-items: center; \
                    gap: 0.5em; \
                    cursor: pointer; \
                }\
                .watchlist-tab.active { background: rgba(255,255,255,0.3); }\
                .watchlist-tab.focus { background: #fff; color: #000; }\
                .watchlist-tab__count { \
                    background: rgba(0,0,0,0.3); \
                    padding: 0.2em 0.5em; \
                    border-radius: 0.3em; \
                    font-size: 0.9em; \
                }\
                .watchlist-subtabs { display: flex; gap: 0.5em; margin-bottom: 1em; }\
                .watchlist-subtab { \
                    padding: 0.5em 1em; \
                    background: rgba(255,255,255,0.05); \
                    border-radius: 0.3em; \
                    font-size: 0.9em; \
                    cursor: pointer; \
                }\
                .watchlist-subtab.active { background: rgba(255,255,255,0.2); }\
                .watchlist-subtab.focus { background: #fff; color: #000; }\
                .watchlist-items { display: flex; flex-wrap: wrap; gap: 1em; }\
                .watchlist-empty { \
                    display: flex; \
                    justify-content: center; \
                    align-items: center; \
                    min-height: 200px; \
                }\
                .watchlist-empty__text { \
                    font-size: 1.2em; \
                    opacity: 0.5; \
                }\
                .watchlist-impression-modal { padding: 1.5em; text-align: center; }\
                .watchlist-impression-modal__title { \
                    font-size: 1.3em; \
                    margin-bottom: 1em; \
                }\
                .watchlist-impression-modal__options { \
                    display: flex; \
                    gap: 1em; \
                    justify-content: center; \
                }\
                .watchlist-impression-option { \
                    padding: 1em 1.5em; \
                    background: rgba(255,255,255,0.1); \
                    border-radius: 0.5em; \
                    cursor: pointer; \
                    text-align: center; \
                }\
                .watchlist-impression-option.focus { background: #fff; color: #000; }\
                .watchlist-impression-option__icon { font-size: 2em; margin-bottom: 0.3em; }\
                .watchlist-impression-option__text { font-size: 0.9em; }\
                .card--watchlist .card__impression { \
                    position: absolute; \
                    top: 0.5em; \
                    right: 0.5em; \
                    font-size: 1.5em; \
                }\
                </style>\
            ';
        }
    };

    // ============================================
    // WATCHLIST COMPONENT
    // ============================================
    function WatchlistComponent(object) {
        var network = new Lampa.Reguest();
        var scroll = new Lampa.Scroll({ mask: true, over: true });
        var html = document.createElement('div');
        var active = 0;
        var currentTab = 'towatch';
        var currentFilter = 'all';
        var items = [];
        var cards = [];

        this.create = function () {
            html.innerHTML = Templates.main();

            // Add styles if not already added
            if (!document.querySelector('#watchlist-plugin-styles')) {
                var styleEl = document.createElement('div');
                styleEl.id = 'watchlist-plugin-styles';
                styleEl.innerHTML = Templates.style();
                document.head.appendChild(styleEl.querySelector('style'));
            }

            this.updateCounts();
            this.loadItems();

            scroll.render().addClass('layer--wheight');
            scroll.append(html);

            this.activity.loader(false);
            this.activity.toggle();
        };

        this.updateCounts = function () {
            var stats = WatchlistStorage.getStats();
            html.querySelector('.towatch-count').textContent = stats.toWatch;
            html.querySelector('.watched-count').textContent = stats.watched;
        };

        this.loadItems = function () {
            var container = html.querySelector('.watchlist-items');
            var empty = html.querySelector('.watchlist-empty');
            var subtabs = html.querySelector('.watchlist-subtabs');

            container.innerHTML = '';
            cards = [];

            // Show/hide subtabs based on current tab
            subtabs.style.display = currentTab === 'watched' ? 'flex' : 'none';

            // Get items based on current tab and filter
            if (currentTab === 'towatch') {
                items = WatchlistStorage.getToWatch();
            } else if (currentFilter === 'all') {
                items = WatchlistStorage.getWatched();
            } else {
                items = WatchlistStorage.getByImpression(currentFilter);
            }

            if (items.length === 0) {
                empty.style.display = 'flex';
                container.style.display = 'none';
            } else {
                empty.style.display = 'none';
                container.style.display = 'flex';

                var _this = this;
                items.forEach(function (item, index) {
                    var card = _this.createCard(item, index);
                    container.appendChild(card);
                    cards.push(card);
                });
            }
        };

        this.createCard = function (item, index) {
            var card = Lampa.Template.get('card', {
                title: item.title,
                release_year: item.release_date ? item.release_date.substring(0, 4) : ''
            });

            card.addClass('card--watchlist');

            // Set poster
            var img = card.find('.card__img')[0];
            if (img && item.poster_path) {
                img.src = 'https://image.tmdb.org/t/p/w300' + item.poster_path;
            }

            // Add impression indicator for watched items
            if (item.watched && item.impression) {
                var icons = { liked: '👍', ok: '👌', disliked: '👎' };
                var indicator = document.createElement('div');
                indicator.className = 'card__impression';
                indicator.textContent = icons[item.impression] || '';
                card.find('.card__view')[0].appendChild(indicator);
            }

            // Store item data
            card[0].watchlistItem = item;

            return card[0];
        };

        this.start = function () {
            var _this = this;

            Lampa.Controller.add('content', {
                toggle: function () {
                    Lampa.Controller.collectionSet(scroll.render());
                    Lampa.Controller.collectionFocus(false, scroll.render());
                },
                left: function () {
                    if (Lampa.Navigator.canmove('left')) Lampa.Navigator.move('left');
                    else Lampa.Controller.toggle('menu');
                },
                right: function () {
                    Lampa.Navigator.move('right');
                },
                up: function () {
                    if (Lampa.Navigator.canmove('up')) Lampa.Navigator.move('up');
                    else Lampa.Controller.toggle('head');
                },
                down: function () {
                    Lampa.Navigator.move('down');
                },
                gone: function () {},
                back: function () {
                    Lampa.Activity.backward();
                }
            });

            Lampa.Controller.toggle('content');

            // Setup navigation
            this.setupNavigation();
        };

        this.setupNavigation = function () {
            var _this = this;

            // Tab clicks
            var tabs = html.querySelectorAll('.watchlist-tab');
            tabs.forEach(function (tab) {
                tab.addEventListener('click', function () {
                    tabs.forEach(function (t) { t.classList.remove('active'); });
                    tab.classList.add('active');
                    currentTab = tab.dataset.tab;
                    currentFilter = 'all';

                    // Reset subtab selection
                    var subtabs = html.querySelectorAll('.watchlist-subtab');
                    subtabs.forEach(function (s) { s.classList.remove('active'); });
                    subtabs[0].classList.add('active');

                    _this.loadItems();
                    _this.updateCounts();
                });
            });

            // Subtab clicks
            var subtabs = html.querySelectorAll('.watchlist-subtab');
            subtabs.forEach(function (subtab) {
                subtab.addEventListener('click', function () {
                    subtabs.forEach(function (s) { s.classList.remove('active'); });
                    subtab.classList.add('active');
                    currentFilter = subtab.dataset.filter;
                    _this.loadItems();
                });
            });

            // Card clicks
            html.addEventListener('click', function (e) {
                var card = e.target.closest('.card--watchlist');
                if (card && card.watchlistItem) {
                    _this.openCard(card.watchlistItem);
                }
            });

            // Setup keyboard/remote navigation
            Lampa.Controller.collectionSet(scroll.render());
            Lampa.Controller.collectionFocus(false, scroll.render());
        };

        this.openCard = function (item) {
            var _this = this;

            Lampa.Select.show({
                title: item.title,
                items: [
                    { title: 'Открыть', action: 'open' },
                    item.watched
                        ? { title: 'Вернуть к просмотру', action: 'unwatch' }
                        : { title: 'Отметить просмотренным', action: 'watch' },
                    { title: 'Удалить из списка', action: 'remove' }
                ],
                onSelect: function (selected) {
                    if (selected.action === 'open') {
                        Lampa.Activity.push({
                            url: '',
                            title: item.title,
                            component: 'full',
                            id: item.tmdb_id,
                            method: item.media_type,
                            card: item
                        });
                    } else if (selected.action === 'watch') {
                        _this.showImpressionModal(item);
                    } else if (selected.action === 'unwatch') {
                        WatchlistStorage.markUnwatched(item.id);
                        Lampa.Noty.show('Возвращено к просмотру');
                        _this.loadItems();
                        _this.updateCounts();
                    } else if (selected.action === 'remove') {
                        WatchlistStorage.removeItem(item.id);
                        Lampa.Noty.show('Удалено из списка');
                        _this.loadItems();
                        _this.updateCounts();
                    }
                },
                onBack: function () {
                    Lampa.Controller.toggle('content');
                }
            });
        };

        this.showImpressionModal = function (item) {
            var _this = this;

            Lampa.Select.show({
                title: 'Как вам ' + item.title + '?',
                items: [
                    { title: '👍 Понравилось', impression: 'liked' },
                    { title: '👌 На разок', impression: 'ok' },
                    { title: '👎 Фигня', impression: 'disliked' }
                ],
                onSelect: function (selected) {
                    WatchlistStorage.markWatched(item.id, selected.impression);
                    Lampa.Noty.show('Отмечено как просмотренное');
                    _this.loadItems();
                    _this.updateCounts();
                },
                onBack: function () {
                    Lampa.Controller.toggle('content');
                }
            });
        };

        this.pause = function () {};

        this.stop = function () {};

        this.render = function () {
            return scroll.render();
        };

        this.destroy = function () {
            network.clear();
            scroll.destroy();
            html.innerHTML = '';
        };
    }

    // ============================================
    // CARD BUTTON INTEGRATION
    // ============================================
    function addWatchlistButton() {
        // Add button to full card view
        Lampa.Listener.follow('full', function (e) {
            if (e.type === 'complite') {
                var card = e.object.card;
                var mediaType = card.media_type || (card.name ? 'tv' : 'movie');
                var isInList = WatchlistStorage.isInWatchlist(card.id, mediaType);
                var existingItem = WatchlistStorage.findByTmdbId(card.id, mediaType);

                var buttons = e.object.activity.render().find('.full-start__buttons');
                if (buttons.length === 0) return;

                // Remove existing watchlist button if any
                buttons.find('.watchlist-btn').remove();

                var btn = document.createElement('div');
                btn.className = 'full-start__button selector watchlist-btn';

                if (isInList) {
                    if (existingItem && existingItem.watched) {
                        var icons = { liked: '👍', ok: '👌', disliked: '👎' };
                        btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg><span>Просмотрено ' + (icons[existingItem.impression] || '') + '</span>';
                    } else {
                        btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M14 10H2v2h12v-2zm0-4H2v2h12V6zm4 8v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zM2 16h8v-2H2v2z"/></svg><span>В списке</span>';
                    }
                } else {
                    btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M14 10H2v2h12v-2zm0-4H2v2h12V6zm4 8v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zM2 16h8v-2H2v2z"/></svg><span>К просмотру</span>';
                }

                btn.addEventListener('click', function () {
                    if (isInList) {
                        // Show options
                        Lampa.Select.show({
                            title: card.title || card.name,
                            items: [
                                existingItem && existingItem.watched
                                    ? { title: 'Вернуть к просмотру', action: 'unwatch' }
                                    : { title: 'Отметить просмотренным', action: 'watch' },
                                { title: 'Удалить из списка', action: 'remove' }
                            ],
                            onSelect: function (selected) {
                                if (selected.action === 'watch') {
                                    Lampa.Select.show({
                                        title: 'Как вам?',
                                        items: [
                                            { title: '👍 Понравилось', impression: 'liked' },
                                            { title: '👌 На разок', impression: 'ok' },
                                            { title: '👎 Фигня', impression: 'disliked' }
                                        ],
                                        onSelect: function (imp) {
                                            WatchlistStorage.markWatched(existingItem.id, imp.impression);
                                            Lampa.Noty.show('Отмечено как просмотренное');
                                            Lampa.Activity.active().activity.render().find('.watchlist-btn').remove();
                                            addWatchlistButton();
                                        }
                                    });
                                } else if (selected.action === 'unwatch') {
                                    WatchlistStorage.markUnwatched(existingItem.id);
                                    Lampa.Noty.show('Возвращено к просмотру');
                                    Lampa.Activity.active().activity.render().find('.watchlist-btn').remove();
                                    addWatchlistButton();
                                } else if (selected.action === 'remove') {
                                    WatchlistStorage.removeItem(existingItem.id);
                                    Lampa.Noty.show('Удалено из списка');
                                    Lampa.Activity.active().activity.render().find('.watchlist-btn').remove();
                                    addWatchlistButton();
                                }
                            }
                        });
                    } else {
                        // Add to watchlist
                        if (WatchlistStorage.addItem(card)) {
                            Lampa.Noty.show('Добавлено в список');
                            // Update button
                            btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M14 10H2v2h12v-2zm0-4H2v2h12V6zm4 8v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zM2 16h8v-2H2v2z"/></svg><span>В списке</span>';
                            isInList = true;
                        } else {
                            Lampa.Noty.show('Уже в списке');
                        }
                    }
                });

                buttons.append(btn);
            }
        });
    }

    // ============================================
    // MENU INTEGRATION
    // ============================================
    function createMenuItem() {
        var item = $('<li class="menu__item selector">\
            <div class="menu__ico">\
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">\
                    <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>\
                </svg>\
            </div>\
            <div class="menu__text">Мой список</div>\
        </li>');

        item.on('hover:enter', function () {
            Lampa.Activity.push({
                url: '',
                title: 'Мой список',
                component: 'watchlist',
                page: 1
            });
        });

        // Add after catalog item or at the end
        var menu = $('.menu .menu__list');
        var catalog = menu.find('[data-action="catalog"]');

        if (catalog.length) {
            catalog.after(item);
        } else {
            menu.append(item);
        }
    }

    // ============================================
    // PLUGIN INITIALIZATION
    // ============================================
    function initPlugin() {
        try {
            // Register component
            Lampa.Component.add('watchlist', WatchlistComponent);

            // Add menu item
            createMenuItem();

            // Add button to card pages
            addWatchlistButton();

            console.log('Watchlist plugin initialized');
        } catch (e) {
            console.error('Watchlist plugin init error:', e);
        }
    }

    // Start plugin
    if (window.appready) {
        initPlugin();
    } else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') {
                initPlugin();
            }
        });
    }

})();
