#Requires AutoHotkey v2.0
#SingleInstance Force

SetTitleMatchMode 2
TraySetIcon A_ScriptDir "\favicon-inverted.ico"

APP_EXE_NAME := "chatgpt-multitab.exe"
NEW_TAB_ARG := "--new-tab"

#Enter::OpenChatGPTMultitabNewTab()
#C::OpenChatGPTMultitabNewTab()

OpenChatGPTMultitabNewTab() {
    appPath := ResolveChatGPTMultitabAppPath()

    if !appPath {
        BringChatGPTMultitabToFront()
        return
    }

    Run Format('"{1}" {2}', appPath, NEW_TAB_ARG)
}

ResolveChatGPTMultitabAppPath() {
    targetTitle := "ChatGPT Multitab"
    hwnd := WinExist(targetTitle)

    if hwnd {
        try {
            runningPath := ProcessGetPath(WinGetPID("ahk_id " hwnd))

            if runningPath && FileExist(runningPath) {
                return runningPath
            }
        }
    }

    candidates := [
        A_ScriptDir "\dist\win-unpacked\" APP_EXE_NAME,
        A_ScriptDir "\" APP_EXE_NAME,
    ]

    for candidate in candidates {
        if FileExist(candidate) {
            return candidate
        }
    }

    return ""
}

BringChatGPTMultitabToFront() {
    targetTitle := "ChatGPT Multitab"
    hwnd := WinExist(targetTitle)

    if !hwnd {
        SoundBeep 750, 100
        return
    }

    WinRestore "ahk_id " hwnd
    WinActivate "ahk_id " hwnd
}
