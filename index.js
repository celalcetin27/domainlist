import express from "express";
import mysql from "mysql"
import cors from "cors"
import bcrypt, { hash } from "bcrypt"
import jwt from "jsonwebtoken"
import axios from "axios"
import nodemailer from "nodemailer";
import cron from "node-cron";



const app = express()

const db = mysql.createConnection({
    host: "localhost",
    user: process.env.USER,
    password: process.env.PASSWORD,
    database: "domainapp"
})


app.use(express.json())
app.use(cors())

app.get("/", (req, res) => {
    res.json("this backend")
})

app.get("/domains", (req, res) => {
    const query = "SELECT * FROM domains"
    db.query(query, (err, data) => {
        if (err) return res.json(err)
        return res.json(data)
    })
})



app.get("/domainjson", (req, res) => {
    const query = "SELECT data FROM domains"
    db.query(query, (err, data) => {
        if (err) return res.json(err)
        return res.json(data)
    })
})

app.post("/domains", async (req, res) => {

    const value = req.body.domains;
    try {
        const response = await axios.get(`https://www.whoisxmlapi.com/whoisserver/WhoisService?apiKey=${process.env.API_KEY}=${value}&outputFormat=json`)
        const domainJson = response.data
        const q = "INSERT INTO domains (domains, data) VALUES (?,?)"
        db.query(q, [value, JSON.stringify(domainJson)], (err, data) => {
            if (err) return res.json(err);
            return res.json("Adding domain");
        });

    } catch (error) {
        return res.json(error)
    }
});

app.delete("/domains/:id", (req, res) => {
    const domainId = req.params.id
    const q = "DELETE FROM domains WHERE id = ?"
    db.query(q, domainId, (err, data) => {
        if (err) return res.json(err)
        return res.json("Deleted domains")
    })
})

app.put("/domains/:id", (req, res) => {
    const domainId = req.params.id
    const updateField = {}
    if (req.body.domains) {
        updateField.domains = req.body.domains
    }

    const q = "UPDATE domains SET ? WHERE id = ? "

    db.query(q, [updateField, domainId], (err, data) => {
        if (err) return res.json(err)
        return res.json("Updated domain name")
    })
})

app.post('/register', (req, res) => {
    const { email, username, password } = req.body
    try {
        if (!email) return res.status(400).json({ message: "Email alanı boş olamaz" })
        else if (!username) return res.status(400).json({ message: "Kullanıcı adı alanı boş olamaz" })
        else if (!password) return res.status(400).json({ message: "Parola alanı boş olamaz" })

        db.query('SELECT * FROM users WHERE email =? ', email, (err, results) => {
            if (err) {
                console.error(err)
                res.status(500).json({ error: 'ınternal server error ' })
            } else {
                if (results.length > 0) {
                    res.status(409).json({ error: 'email already exist' })
                } else {
                    bcrypt.hash(password, 10, (err, hash) => {
                        if (err) {
                            console.error(err)
                            res.status(500).json({ error: "ınternal server error" })
                        } else {
                            const user = { email, username, password: hash }

                            db.query("INSERT INTO users SET ?", user, (err, results) => {
                                if (err) {
                                    console.error(err)
                                    res.status(500).json({ error: "kayıt sırasında problem olustu" })
                                } else {
                                    res.status(200).json({ message: "user registered succesfuly" })
                                }
                            })
                        }
                    })
                }
            }
        })
    } catch (error) {
        console.log(error);
    }
})

app.post("/login", (req, res) => {
    const { username, password } = req.body
    try {
        const query = 'SELECT * FROM users WHERE username = ?'
        db.query(query, username, (err, results) => {
            if (err) {
                res.status(500).json({ error: "giriş sırasında bir hata oldu" })
            } else {
                if (results.length === 0) {
                    res.status(401).json({ error: "kullanıcı bulunamadı" })
                } else {
                    bcrypt.compare(password, results[0].password, (err, isMatch) => {
                        if (err) {
                            res.status(500).json({ error: "giris sirasında bir hata olustu" })

                        } else if (isMatch) {
                            const user = { id: results[0].id, username: results[0].username }

                            const token = jwt.sign(user, 'secret key succesfuly')
                            res.status(200).json({ token, "state": "basarili" })
                        } else {
                            res.status(401).json({ error: "hatali sifre" })
                        }
                    })
                }
            }
        })

    } catch (error) {
        console.log(error);
    }
})

app.post("/logout", (req, res) => {
    const authorizationHeader = req.headers.authorization;
    if (!authorizationHeader) {
        return res.status(401).json({ error: "Token not provided" });
    }

    const token = authorizationHeader.split(" ")[1];
    try {
        jwt.verify(token, "secret key", (err, decoded) => {
            if (err) {
                return res.status(401).json({ error: "Invalid token" });
            }
            res.status(200).json({ message: "Logout successful" });
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({ error: "An error occurred" });
    }
});

async function sendEmail(receiverEmail, subject, content) {
    try {
        let transporter = nodemailer.createTransport({
            service: "Gmail",
            auth: {
                user:   process.env.MAIL,
                pass: process.env.MAIL_PASSWORD,
            },
        });

        let mailOptions = {
            from: process.env.MAIL_PASSWORD,
            to: receiverEmail,
            subject: subject,
            html: content,
        };

        await transporter.sendMail(mailOptions);
        console.log("E-posta gönderildi:", mailOptions);
    } catch (error) {
        console.error("E-posta gönderirken hata oluştu:", error);
    }
}



const checkDomain = async () => {

    const checkingRemainingDay = 350;
    const InMilliseconds = checkingRemainingDay * 24 * 60 * 60 * 1000;

    const domainRows = [];

    const query = "SELECT * FROM domains";
    db.query(query, async (err, data) => {
        if (err) {
            console.error("Domainleri sorgularken hata oluştu:", err);
            return;
        }
        for (const domain of data) {
            const domainInfo = JSON.parse(domain.data);
            const expirationDate = new Date(domainInfo.WhoisRecord.registryData.expiresDate);
            const remainingDays = Math.floor((expirationDate - Date.now()) / (24 * 60 * 60 * 1000));
            const localExpirationDate = expirationDate.toLocaleDateString();
            const thirtyDaysBeforeExpiration = new Date(Date.now() + InMilliseconds);

            if (expirationDate < thirtyDaysBeforeExpiration) {
                const row = `
                    <tr>
                        <td>${domain.domains}</td>
                        <td>${localExpirationDate}</td>
                        <td>${remainingDays} gün</td>
                    </tr>
                `;
                domainRows.push(row);
            }
        }

        if (domainRows.length > 0) {
            const domainTable = `
                <table style="font-family: Arial, sans-serif; border-collapse: collapse; width: 100%;">
                    <tr>
                        <th style="background-color: #f2f2f2; padding: 8px; text-align: left; border-bottom: 1px solid #ddd;">Domain</th>
                        <th style="background-color: #f2f2f2; padding: 8px; text-align: left; border-bottom: 1px solid #ddd;">Son Kullanma Tarihi</th>
                        <th style="background-color: #f2f2f2; padding: 8px; text-align: left; border-bottom: 1px solid #ddd;">Kalan Gün</th>
                    </tr>
                    ${domainRows.join("")}
                </table>
            `;

            const domainOwnerEmail = process.env.CUSTOMER_MAIL;
            const subject = "Domainlerinizin Süresi Dolmak Üzere";
            const content = `
                <div style="font-family: Arial, sans-serif; background-color: #f0f0f0; padding: 20px;">
                    <h1 style="color: #007bff;">Emre Bey  Merhaba!</h1>
                    <p style="color: #333;"> Süresi dolmak üzere olan domainleriniz bulunmaktadır:</p>
                    ${domainTable}
                </div>
            `;

            await sendEmail(domainOwnerEmail, subject, content);
            console.log("E-posta gönderildi: Tüm domainler");
        } else {
            console.log("Süresi dolmak üzere olan domain bulunmamaktadır.");
        }
    });
};






cron.schedule("0 0 * * *", async () => {
    console.log("Cron working...")
        await checkDomain()
});



app.listen(8080, () => {
    console.log("connected 8080 ");
})
