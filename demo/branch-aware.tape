Output assets/branch-aware.gif
Output assets/branch-aware.mp4

Require node
Require pi

Set Shell "zsh"
Set FontFamily "Menlo"
Set FontSize 16
Set LetterSpacing 0
Set LineHeight 1.1
Set Width 1200
Set Height 700
Set Padding 18
Set Framerate 30
Set TypingSpeed 45ms
Set Theme {"background":"#0d1117","foreground":"#e6edf3","black":"#0d1117","brightBlack":"#6e7681","red":"#ff7b72","brightRed":"#ffa198","green":"#3fb950","brightGreen":"#56d364","yellow":"#d29922","brightYellow":"#e3b341","blue":"#58a6ff","brightBlue":"#79c0ff","magenta":"#bc8cff","brightMagenta":"#d2a8ff","cyan":"#39c5cf","brightCyan":"#56d4dd","white":"#b1bac4","brightWhite":"#f0f6fc"}

Hide
Type "node demo/branch-aware-session.mjs && PI_OFFLINE=1 pi --session /tmp/pi-todo-branch-demo/session.jsonl -e . -ne -ns -np --no-themes -nc -a"
Enter
Sleep 3s
Show

Sleep 2s
Type "/tree"
Enter
Sleep 2s
Down@250ms 2
Enter
Sleep 1s
Enter
Sleep 3s

Type "/tree"
Enter
Sleep 2s
Down@250ms 2
Enter
Sleep 1s
Enter
Sleep 3s
