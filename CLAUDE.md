# CLAUDE.md

Плагин "Мой список" для Lampa TV — управление списком фильмов и сериалов к просмотру.

## Структура

```
lampa-watchlist/
├── watchlist.js    # Основной файл плагина (один файл, IIFE)
└── README.md       # Документация и инструкция по установке
```

## Архитектура плагина

Плагин написан как IIFE (Immediately Invoked Function Expression) для Lampa:

- **Manifest** — регистрация через `Lampa.Manifest.plugins`
- **Storage** — CRUD операции через `Lampa.Storage` (localStorage)
- **Component** — компонент списка через `Lampa.Component.add()`
- **Button** — кнопка на карточке фильма через `Lampa.Listener.follow('full')`
- **Menu** — пункт меню через jQuery манипуляции

## Ключевые API Lampa

```javascript
Lampa.Storage.get(key, default)     // Чтение из localStorage
Lampa.Storage.set(key, value)       // Запись в localStorage
Lampa.Component.add(name, Class)    // Регистрация компонента
Lampa.Activity.push({...})          // Переход на экран
Lampa.Select.show({...})            // Модальное меню выбора
Lampa.Noty.show(message)            // Уведомление
Lampa.Listener.follow(event, fn)    // Подписка на события
```

## Селекторы UI (Lampa 3.x)

- `.full-start-new__buttons` — контейнер кнопок на карточке (новый UI)
- `.full-start__buttons` — контейнер кнопок (старый UI)
- `.full-start__button` — класс кнопки с тёмным фоном
- `.menu .menu__list` — список пунктов меню

## Релизы

При выпуске новой версии:

```bash
# 1. Обновить version в manifest (watchlist.js)
# 2. Обновить версию в README.md
# 3. Коммит и пуш
git add -A && git commit -m "..." && git push

# 4. Создать тег
git tag v1.0.X && git push origin v1.0.X
```

URL для установки (jsDelivr с версией):
```
https://cdn.jsdelivr.net/gh/darklion84/lampa-watchlist@v1.0.X/watchlist.js
```

## Модель данных

```javascript
// Ключ: 'watchlist_data'
{
  items: [{
    id: "tmdb_movie_12345",
    tmdb_id: 12345,
    media_type: "movie",        // movie | tv
    title: "...",
    poster_path: "/...",
    vote_average: 7.5,
    release_date: "2024-01-15",
    watched: false,
    impression: null,           // liked | ok | disliked
    added_at: 1234567890,
    watched_at: null
  }]
}
```

## Тестирование

1. Установить плагин в Lampa (Настройки → Плагины)
2. Проверить пункт "Мой список" в меню
3. Открыть карточку фильма → кнопка "К просмотру"
4. Добавить фильм → проверить в списке
5. Отметить просмотренным с впечатлением
6. Проверить фильтрацию по вкладкам
