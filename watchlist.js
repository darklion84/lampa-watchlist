(function () {
    'use strict';

    // Prevent double initialization
    if (window.watchlist_plugin) return;
    window.watchlist_plugin = true;

    // ============================================
    // MANIFEST
    // ============================================
    var manifest = {
        type: 'other',
        version: '1.0.0',
        name: 'Мой список',
        description: 'Список фильмов и сериалов к просмотру',
        component: 'watchlist'
    };

    // ============================================
    // STORAGE
    // ============================================
    var STORAGE_KEY = 'watchlist_data';

    var Storage = {
        get: function () {
            return Lampa.Storage.get(STORAGE_KEY, { items: [] });
        },
        save: function (data) {
            Lampa.Storage.set(STORAGE_KEY, data);
        },
        add: function (card) {
            var data = this.get();
            var type = card.media_type || (card.name ? 'tv' : 'movie');
            var id = 'tmdb_' + type + '_' + card.id;

            if (data.items.find(function (i) { return i.id === id; })) {
                return false;
            }

            data.items.push({
                id: id,
                tmdb_id: card.id,
                media_type: type,
                title: card.title || card.name,
                original_title: card.original_title || card.original_name,
                poster_path: card.poster_path,
                vote_average: card.vote_average,
                release_date: card.release_date || card.first_air_date,
                overview: card.overview,
                watched: false,
                impression: null,
                added_at: Date.now(),
                watched_at: null
            });
            this.save(data);
            return true;
        },
        remove: function (id) {
            var data = this.get();
            data.items = data.items.filter(function (i) { return i.id !== id; });
            this.save(data);
        },
        find: function (tmdbId, mediaType) {
            var id = 'tmdb_' + mediaType + '_' + tmdbId;
            return this.get().items.find(function (i) { return i.id === id; });
        },
        exists: function (tmdbId, mediaType) {
            return !!this.find(tmdbId, mediaType);
        },
        markWatched: function (id, impression) {
            var data = this.get();
            var item = data.items.find(function (i) { return i.id === id; });
            if (item) {
                item.watched = true;
                item.impression = impression;
                item.watched_at = Date.now();
                this.save(data);
            }
        },
        markUnwatched: function (id) {
            var data = this.get();
            var item = data.items.find(function (i) { return i.id === id; });
            if (item) {
                item.watched = false;
                item.impression = null;
                item.watched_at = null;
                this.save(data);
            }
        },
        getToWatch: function () {
            return this.get().items.filter(function (i) { return !i.watched; });
        },
        getWatched: function () {
            return this.get().items.filter(function (i) { return i.watched; });
        },
        getByImpression: function (imp) {
            return this.get().items.filter(function (i) { return i.watched && i.impression === imp; });
        }
    };

    // ============================================
    // COMPONENT
    // ============================================
    function Component(object) {
        var scroll = new Lampa.Scroll({ mask: true, over: true });
        var html = $('<div class="watchlist"></div>');
        var content = $('<div class="category-full"></div>');
        var tab = 'towatch';
        var filter = 'all';

        this.create = function () {
            this.activity.loader(true);

            var _this = this;

            // Add CSS
            if (!$('#watchlist-css').length) {
                $('head').append('\
                    <style id="watchlist-css">\
                    .watchlist { padding: 1.5em; }\
                    .watchlist-tabs { display: flex; margin-bottom: 1.5em; }\
                    .watchlist-tab { padding: 0.8em 1.5em; margin-right: 0.5em; background: rgba(255,255,255,0.1); border-radius: 0.3em; cursor: pointer; }\
                    .watchlist-tab.active { background: rgba(255,255,255,0.3); }\
                    .watchlist-tab.focus { background: #fff !important; color: #000; }\
                    .watchlist-filters { display: flex; margin-bottom: 1em; }\
                    .watchlist-filter { padding: 0.5em 1em; margin-right: 0.5em; background: rgba(255,255,255,0.05); border-radius: 0.3em; font-size: 0.9em; cursor: pointer; }\
                    .watchlist-filter.active { background: rgba(255,255,255,0.2); }\
                    .watchlist-filter.focus { background: #fff !important; color: #000; }\
                    .watchlist-empty { padding: 2em; text-align: center; opacity: 0.5; }\
                    .watchlist-card-badge { position: absolute; top: 0.5em; right: 0.5em; font-size: 1.3em; }\
                    </style>\
                ');
            }

            // Tabs
            var tabs = $('\
                <div class="watchlist-tabs">\
                    <div class="watchlist-tab selector active" data-tab="towatch">К просмотру</div>\
                    <div class="watchlist-tab selector" data-tab="watched">Просмотрено</div>\
                </div>\
            ');

            // Filters (for watched tab)
            var filters = $('\
                <div class="watchlist-filters" style="display:none">\
                    <div class="watchlist-filter selector active" data-filter="all">Все</div>\
                    <div class="watchlist-filter selector" data-filter="liked">👍</div>\
                    <div class="watchlist-filter selector" data-filter="ok">👌</div>\
                    <div class="watchlist-filter selector" data-filter="disliked">👎</div>\
                </div>\
            ');

            html.append(tabs);
            html.append(filters);
            html.append(content);

            scroll.render().addClass('layer--wheight');
            scroll.append(html);

            // Tab events
            tabs.find('.watchlist-tab').on('hover:enter', function () {
                tabs.find('.watchlist-tab').removeClass('active');
                $(this).addClass('active');
                tab = $(this).data('tab');
                filter = 'all';
                filters.find('.watchlist-filter').removeClass('active').first().addClass('active');
                filters.toggle(tab === 'watched');
                _this.loadItems();
            });

            // Filter events
            filters.find('.watchlist-filter').on('hover:enter', function () {
                filters.find('.watchlist-filter').removeClass('active');
                $(this).addClass('active');
                filter = $(this).data('filter');
                _this.loadItems();
            });

            this.loadItems();
            this.activity.loader(false);
            this.activity.toggle();
        };

        this.loadItems = function () {
            var _this = this;
            var items;

            if (tab === 'towatch') {
                items = Storage.getToWatch();
            } else if (filter === 'all') {
                items = Storage.getWatched();
            } else {
                items = Storage.getByImpression(filter);
            }

            content.empty();

            if (items.length === 0) {
                content.append('<div class="watchlist-empty">Список пуст</div>');
            } else {
                items.forEach(function (item) {
                    var card = Lampa.Template.get('card', {
                        title: item.title,
                        release_year: item.release_date ? item.release_date.substring(0, 4) : ''
                    });

                    var img = card.find('.card__img');
                    if (item.poster_path) {
                        img.attr('src', 'https://image.tmdb.org/t/p/w300' + item.poster_path);
                    }

                    // Add impression badge
                    if (item.watched && item.impression) {
                        var icons = { liked: '👍', ok: '👌', disliked: '👎' };
                        card.find('.card__view').append('<div class="watchlist-card-badge">' + icons[item.impression] + '</div>');
                    }

                    card.on('hover:enter', function () {
                        _this.showMenu(item);
                    });

                    content.append(card);
                });
            }
        };

        this.showMenu = function (item) {
            var _this = this;
            var items = [
                { title: 'Открыть', action: 'open' }
            ];

            if (item.watched) {
                items.push({ title: 'Вернуть к просмотру', action: 'unwatch' });
            } else {
                items.push({ title: 'Отметить просмотренным', action: 'watch' });
            }
            items.push({ title: 'Удалить из списка', action: 'remove' });

            Lampa.Select.show({
                title: item.title,
                items: items,
                onSelect: function (s) {
                    if (s.action === 'open') {
                        Lampa.Activity.push({
                            url: '',
                            title: item.title,
                            component: 'full',
                            id: item.tmdb_id,
                            method: item.media_type,
                            card: item
                        });
                    } else if (s.action === 'watch') {
                        _this.showImpression(item);
                    } else if (s.action === 'unwatch') {
                        Storage.markUnwatched(item.id);
                        Lampa.Noty.show('Возвращено к просмотру');
                        _this.loadItems();
                    } else if (s.action === 'remove') {
                        Storage.remove(item.id);
                        Lampa.Noty.show('Удалено');
                        _this.loadItems();
                    }
                },
                onBack: function () {
                    Lampa.Controller.toggle('content');
                }
            });
        };

        this.showImpression = function (item) {
            var _this = this;

            Lampa.Select.show({
                title: 'Как вам?',
                items: [
                    { title: '👍 Понравилось', value: 'liked' },
                    { title: '👌 На разок', value: 'ok' },
                    { title: '👎 Не понравилось', value: 'disliked' }
                ],
                onSelect: function (s) {
                    Storage.markWatched(item.id, s.value);
                    Lampa.Noty.show('Отмечено');
                    _this.loadItems();
                },
                onBack: function () {
                    Lampa.Controller.toggle('content');
                }
            });
        };

        this.start = function () {
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
        };

        this.pause = function () {};
        this.stop = function () {};
        this.render = function () { return scroll.render(); };
        this.destroy = function () {
            scroll.destroy();
            html.remove();
        };
    }

    // ============================================
    // BUTTON ON CARD PAGE
    // ============================================
    function addButton() {
        Lampa.Listener.follow('full', function (e) {
            if (e.type === 'complite') {
                var card = e.object.card;
                var type = card.media_type || (card.name ? 'tv' : 'movie');
                var inList = Storage.exists(card.id, type);
                var item = Storage.find(card.id, type);

                var render = e.object.activity.render();
                render.find('.watchlist-btn').remove();

                // Try both old and new button container selectors
                var buttons = render.find('.full-start-new__buttons');
                if (!buttons.length) buttons = render.find('.full-start__buttons');
                if (!buttons.length) return;

                var btn = $('<div class="full-start-new__button selector watchlist-btn"></div>');

                if (inList) {
                    if (item && item.watched) {
                        var icons = { liked: '👍', ok: '👌', disliked: '👎' };
                        btn.text('Просмотрено ' + (icons[item.impression] || ''));
                    } else {
                        btn.text('В списке ✓');
                    }
                } else {
                    btn.text('К просмотру +');
                }

                btn.on('hover:enter', function () {
                    if (!inList) {
                        if (Storage.add(card)) {
                            Lampa.Noty.show('Добавлено в список');
                            btn.text('В списке ✓');
                            inList = true;
                            item = Storage.find(card.id, type);
                        }
                    } else {
                        Lampa.Select.show({
                            title: card.title || card.name,
                            items: item && item.watched
                                ? [{ title: 'Вернуть к просмотру', action: 'unwatch' }, { title: 'Удалить', action: 'remove' }]
                                : [{ title: 'Отметить просмотренным', action: 'watch' }, { title: 'Удалить', action: 'remove' }],
                            onSelect: function (s) {
                                if (s.action === 'watch') {
                                    Lampa.Select.show({
                                        title: 'Как вам?',
                                        items: [
                                            { title: '👍 Понравилось', value: 'liked' },
                                            { title: '👌 На разок', value: 'ok' },
                                            { title: '👎 Не понравилось', value: 'disliked' }
                                        ],
                                        onSelect: function (imp) {
                                            Storage.markWatched(item.id, imp.value);
                                            Lampa.Noty.show('Отмечено');
                                            var icons = { liked: '👍', ok: '👌', disliked: '👎' };
                                            btn.text('Просмотрено ' + icons[imp.value]);
                                        }
                                    });
                                } else if (s.action === 'unwatch') {
                                    Storage.markUnwatched(item.id);
                                    btn.text('В списке ✓');
                                    Lampa.Noty.show('Возвращено к просмотру');
                                } else if (s.action === 'remove') {
                                    Storage.remove(item.id);
                                    btn.text('К просмотру +');
                                    inList = false;
                                    item = null;
                                    Lampa.Noty.show('Удалено');
                                }
                            }
                        });
                    }
                });

                buttons.append(btn);
            }
        });
    }

    // ============================================
    // MENU ITEM
    // ============================================
    function addMenu() {
        var ico = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>';

        var item = $('<li class="menu__item selector">\
            <div class="menu__ico">' + ico + '</div>\
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

        $('.menu .menu__list').eq(0).append(item);
    }

    // ============================================
    // PLUGIN START
    // ============================================
    function startPlugin() {
        Lampa.Manifest.plugins = manifest;
        Lampa.Component.add('watchlist', Component);
        addMenu();
        addButton();
    }

    if (window.appready) {
        startPlugin();
    } else {
        Lampa.Listener.follow('app', function (e) {
            if (e.type === 'ready') {
                startPlugin();
            }
        });
    }

})();
