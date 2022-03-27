local wezterm = require "wezterm";

return {
    font = wezterm.font_with_fallback({
        {
            family = "Iosevka Term",
            weight = "Regular",
            harfbuzz_features = {
                "calt=1",
                "clig=1",
                "liga=1",
                "ss07",
                "HSKL",
            },
        },
        "Apple Color Emoji",
    }),
    font_size = 16,
}
