export ZSH="$HOME/.oh-my-zsh"
ZSH_THEME="fino" # set by `omz`

# No automatic oh-my-zsh update check: it does network I/O on a timer, which is
# pointless in non-interactive/agent shells and a stall risk in any shell init
# that gets captured. Update manually with `omz update` when you want to.
zstyle ':omz:update' mode disabled

plugins=(git dotenv)

source $ZSH/oh-my-zsh.sh

HISTFILE=~/.histfile
HISTSIZE=10000
SAVEHIST=10000
setopt autocd
bindkey -e

autoload -U select-word-style
select-word-style bash

[[ -f "$HOME/.zshrc_local" ]] && source "$HOME/.zshrc_local"

[[ -f "$HOME/.local/bin/env" ]] && source "$HOME/.local/bin/env"

# >>> grok installer >>>
export PATH="$HOME/.grok/bin:$PATH"
fpath=(~/.grok/completions/zsh $fpath)
autoload -Uz compinit && compinit -C
# <<< grok installer <<<

# Vite+ bin (https://viteplus.dev)
. "/Users/emliunix/.config/vite-plus/env"
