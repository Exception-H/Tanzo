!macro customUnInstall
  IfSilent deleteUserDataDone
  MessageBox MB_YESNO|MB_ICONQUESTION "Delete Tanzo user data too? This removes local settings, conversations, provider configuration, logs, wallpapers, and the local database. Choose No to keep data for a future reinstall." IDNO deleteUserDataDone
  RMDir /r "$APPDATA\Tanzo"
  RMDir /r "$LOCALAPPDATA\Tanzo"
deleteUserDataDone:
!macroend
