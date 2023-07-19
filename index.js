import  express  from "express";
import mysql from "mysql"
import cors from "cors"
import bcrypt , {hash} from "bcrypt"
import jwt from "jsonwebtoken"
import sessionstroge from "sessionstorage"

const tokenBlackList = new Set()

const app = express()

const db = mysql.createConnection({
    host :"localhost",
    user : "root",
    password : "root123",
    database : "domainapp"
})

app.use(express.json())
app.use(cors())

app.get("/" , (req,res) => {
    res.json("this backend")
})

app.get("/domains" , (req,res)=>{
    const query = "SELECT * FROM domains"
    db.query(query,(err,data) =>{
        if(err) return res.json(err)
        return res.json(data)
    })
})

app.post("/domains", (req, res) => {
    const q = "INSERT INTO domains (`domains`) VALUES (?)";
    const value = req.body.domains;
    db.query(q, [value], (err, data) => {
      if (err) return res.json(err);
      return res.json("Adding domain");
    });
  });

app.delete("/domains/:id" , (req,res) => {
    const domainId = req.params.id
    const q = "DELETE FROM domains WHERE id = ?"
    db.query(q, domainId, (err,data) =>{
        if(err) return res.json(err)
        return res.json("Deleted domains")
    } )
})

app.put("/domains/:id" , (req,res)=> {
    const domainId = req.params.id
    const updateField = {}

    if (req.body.domains) {
        updateField.domains = req.body.domains
    }

    const q = "UPDATE domains SET ? WHERE id = ? "

    db.query(q,[updateField,domainId], (err,data) => {
        if(err) return res.json(err)
        return res.json("Updated domain name")
    })
})

app.post('/register' , (req,res) => {
    const {email,username,password} = req.body
    try {
        if (!email) return res.status(400).json({ message: "Email alanı boş olamaz" })
        else if(!username) return res.status(400).json({ message: "Kullanıcı adı alanı boş olamaz" })
        else if(!password) return res.status(400).json({ message: "Parola alanı boş olamaz" })   
        
        db.query('SELECT * FROM users WHERE email =? ' , email , (err,results)=>{
            if(err){
                console.error(err)
                res.status(500).json({error : 'ınternal server error '})
            }else {
                if (results.length >0) {
                    res.status(409).json({error : 'email already exist'})
                }else{
                    bcrypt.hash(password,10, (err,hash)=>{
                        if (err) {
                            console.error(err)
                            res.status(500).json({error : "ınternal server error"})
                        } else {
                            const user = {email,username,password : hash}
    
                            db.query("INSERT INTO users SET ?" , user, (err,results) => {
                                if (err) {
                                    console.error(err)
                                    res.status(500).json({error : "kayıt sırasında problem olustu"})
                                }else {
                                    res.status(200).json({message : "user registered succesfuly"})
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

app.post("/login" , (req,res)=> {
    const {username,password} = req.body
    try {
        const query = 'SELECT * FROM users WHERE username = ?'
        db.query(query, username, (err,results)=> {
            if (err) {
                res.status(500).json({error : "giriş sırasında bir hata oldu"})
            }else {
                if (results.length ===0) {        
                    res.status(401).json({error: "kullanıcı bulunamadı"})
                }else {
                    bcrypt.compare(password,results[0].password, (err,isMatch)=> {
                        if (err) {
                            res.status(500).json({error : "giris sirasında bir hata olustu"})
    
                        }else if (isMatch) {
                            const user = {id : results[0].id, username : results[0].username}
    
                            const token = jwt.sign(user, 'secret key succesfuly')
                            res.status(200).json({token, "state" : "basarili"})
                        } else {
                            res.status(401).json({error : "hatali sifre"})
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
  
  
app.listen(8080, () => {
    console.log("connected 8080 ");
})