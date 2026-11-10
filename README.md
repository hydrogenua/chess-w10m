# Chess для Windows 10 Mobile

Нативные шахматы для Windows 10 Mobile (HP Elite x3 и подобных) — свой движок, свой бот, своё окно, **без браузера и без Visual Studio**.

Появилось из попытки сделать «PWA chess.com» на телефоне: выяснилось, что встроенный Edge (EdgeHTML ~16) не тянет ни chess.com, ни lichess (SSR рендерится, гидрация React умирает, вёрстка рассыпается), а PWA на W10M не существуют. Итог — свои шахматы целиком на HTML/JS (ES5), упакованные в UWP через makeappx.

## Что умеет

- Партия с ботом (3 уровня: глубина 1–3, альфа-бета + piece-square tables) или вдвоём на одном телефоне
- Полные правила: рокировки, взятие на проходе, превращение (авто-ферзь), мат/пат, правило 50 ходов, недостаток материала
- Ходы тап-тап: тап по фигуре → зелёные точки легальных ходов → тап по цели
- Подсветка последнего хода, «Шах!», отмена ходов, доска переворачивается за чёрных
- Звуки (WebAudio-синтез без ассетов): ход, взятие, шах, фанфары на мате
- 5 тем поля, 3 стиля фигур; выбор запоминается (localStorage с валидацией)
- Размер доски адаптируется под экран/ориентацию

## Структура

```
src/
  AppxManifest.xml   манифест UWP (JS-приложение, StartPage=default.html)
  default.html/css/js меню + доска
  js/engine.js        движок правил (перфт-верифицирован)
  js/bot.js           бот: негамакс + альфа-бета + PST
  assets/             плитки/сплэш (генерятся tools/gen-assets.ps1)
tools/
  gen-assets.ps1      PNG-плитки через WPF PngBitmapEncoder (НЕ System.Drawing —
                      его PNG валят WWAHost на телефоне)
  make-cert.ps1       самоподписанный серт подписи (CN=ChessCom Dev)
  build.ps1           stage → makeappx → signtool
  deploy.ps1          деплой по Device Portal REST (pair/CSRF/install/launch)
  test-engine.js      перфт-тесты + самопартия бота (запуск через node)
  static-server.js    локальный сервер для тестов UI
```

## Сборка и деплой

Нужны: Windows 10 SDK (makeappx/signtool), PowerShell, телефон в той же Wi-Fi сети с включёнными Developer mode + Device discovery.

```powershell
powershell -File tools\make-cert.ps1     # один раз
powershell -File tools\build.ps1         # build\out\ChessComMobile_<ver>_neutral.appx
powershell -File tools\deploy.ps1 -Ip 192.168.x.x -Pin 123abc -Launch
```

Нюансы Device Portal W10M, на которых всё ломается (см. комментарии в deploy.ps1):
первый GET отдаёт 307 + CSRF-куку (её значение = заголовок X-CSRF-Token для всех POST/DELETE),
PIN одноразовый, лимит dev-sideload считает даже обновления, у этого WDP в packages list
`PackageFamilyName` без хэша издателя — для запуска нужен `PackageRelativeId`,
поллинг состояния сразу после install-202 часто рвётся (пакет при этом встаёт).

## Тесты движка

```bash
node tools/test-engine.js   # или ELECTRON_RUN_AS_NODE=1 <electron> tools/test-engine.js
```

Перфт: startpos 20/400/8902, Kiwipete 48/2039, позиции с ep/promotion — все сходятся.

## Игра в chess.com / lichess на W10M

Нативно chess.com невозможен (закрытый API), а сайт не работает на EdgeHTML. Рабочий путь на телефоне — современные порты движков: **Venetium** (Chromium 150) и **Gecko** (Firefox 155). В истории git есть v1.2 — лаунчер, который по тапу плитки открывает chess.com в Venetium напрямую (мимо системных умолчаний, которые на W10M не поменять).

## План

- v2.2: онлайн-партии через API lichess (нужен личный API-токен)

---
Лицензия: MIT
