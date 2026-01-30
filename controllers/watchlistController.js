module.exports.getWatchlist = (req, res) => {
    if (!req.session.watchlist) req.session.watchlist = [];

    res.render("watchlist", {
        title: "Watchlist",
        currentUser: res.locals.currentUser,
        items: req.session.watchlist
    });
};

module.exports.addToWatchlist = (req, res) => {
    const symbol = req.body.symbol?.trim().toUpperCase();

    if (!symbol) {
        req.flash("error", "Symbol cannot be empty");
        return res.redirect("/watchlist");
    }

    if (!req.session.watchlist) req.session.watchlist = [];

    if (!req.session.watchlist.includes(symbol)) {
        req.session.watchlist.push(symbol);
    } else {
        req.flash("error", "Symbol already in watchlist");
    }

    res.redirect("/watchlist");
};

module.exports.removeFromWatchlist = (req, res) => {
    const symbol = req.params.symbol?.trim().toUpperCase();

    if (req.session.watchlist) {
        req.session.watchlist = req.session.watchlist.filter(
            (item) => item !== symbol
        );
    }

    res.redirect("/watchlist");
};
