const bcrypt = require('bcrypt');
const db = require('../db');

module.exports = {
    getAllUsers: (req, res) => {
        const sql = `SELECT u.userId, u.username, u.email, u.roleId, p.fullName, p.avatar
                     FROM users u
                     LEFT JOIN user_profiles p ON u.userId = p.userId`;
        db.query(sql, (err, results) => {
            if(err) throw err;
            res.render('users', { users: results });
        });
    },

    addUser: (req, res) => {
        const { username, email, password, roleId } = req.body;
        const avatar = req.file ? req.file.filename : null;

        bcrypt.hash(password, 10, (err, hash) => {
            if(err) throw err;
            const insertSql = 'INSERT INTO users (username, email, password, roleId) VALUES (?, ?, ?, ?)';
            db.query(insertSql, [username, email, hash, roleId], (err, result) => {
                if(err) throw err;
                const userId = result.insertId;
                const profileSql = 'INSERT INTO user_profiles (userId, avatar) VALUES (?, ?)';
                db.query(profileSql, [userId, avatar], (err) => {
                    if(err) throw err;
                    req.flash('success', 'User added successfully');
                    res.redirect('/users');
                });
            });
        });
    },

    editUserForm: (req, res) => {
        const id = req.params.id;
        const sql = `SELECT u.userId, u.username, u.email, u.roleId, p.avatar
                     FROM users u
                     LEFT JOIN user_profiles p ON u.userId = p.userId
                     WHERE u.userId = ?`;
        db.query(sql, [id], (err, results) => {
            if(err) throw err;
            const user = results[0];
            res.render('users_edit', { user });
        });
    },

    updateUser: (req, res) => {
        const id = req.params.id;
        const { username, email, roleId } = req.body;
        let avatar = req.file ? req.file.filename : null;

        const getSql = 'SELECT avatar FROM user_profiles WHERE userId = ?';
        db.query(getSql, [id], (err, results) => {
            if(err) throw err;
            const oldAvatar = results[0].avatar;
            const finalAvatar = avatar || oldAvatar;

            const updateUserSql = 'UPDATE users SET username=?, email=?, roleId=? WHERE userId=?';
            db.query(updateUserSql, [username, email, roleId, id], (err) => {
                if(err) throw err;
                const updateProfileSql = 'UPDATE user_profiles SET avatar=? WHERE userId=?';
                db.query(updateProfileSql, [finalAvatar, id], (err) => {
                    if(err) throw err;
                    req.flash('success', 'User updated successfully');
                    res.redirect('/users');
                });
            });
        });
    },

    deleteUser: (req, res) => {
        const id = req.params.id;
        const sql = 'DELETE FROM users WHERE userId=?';
        db.query(sql, [id], (err) => {
            if(err) throw err;
            req.flash('success', 'User deleted successfully');
            res.redirect('/users');
        });
    }
};
