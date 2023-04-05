Set-PSReadLineOption -EditMode Emacs

$myPsColor = @{
    "Variable" = "Blue"
    "Type" = "Blue"
    "Operator" = "DarkYellow"
    "Parameter" = "DarkYellow"
}

Set-PSReadLineOption -Colors $myPsColor

$myVsInstallPath = "C:\Program Files (x86)\Microsoft Visual Studio\2019\Community\"

function Enable-VsEnv {
    Import-Module (Join-Path $myVsInstallPath "Common7\Tools\Microsoft.VisualStudio.DevShell.dll")
    Enter-VsDevShell -VsInstallPath $myVsInstallPath
}
