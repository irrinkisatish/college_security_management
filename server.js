const express = require('express');
const mysql = require('mysql2');
const cors = require("cors");
const bcrypt  = require("bcrypt");
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const app = express();
const path = require("path")
const multer = require('multer')
app.use(cors());
app.use(bodyParser.json());

app.use(bodyParser.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, 'public')));

app.use('/facultyimages',express.static('facultyimages'));
app.use('/images',express.static('images'));

const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'toor',
    database: 'security',
    port: 3306
  });
  
  db.connect((err) => {
    if (err) {
      console.error('Error connecting to MySQL:', err);
      return;
    }
    console.log('Connected to MySQL database');
  });
  
  const facultystorage = multer.diskStorage({
    destination: 'C:/studentfeedback/public/studentimages',
    filename: function (req, file, callback) {
      callback(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
  });
  
  const facultyupload = multer({ storage: facultystorage });
  
  const authenticateFacultyToken = (request, response, next) => {
    let jwtToken;
    const authHeader = request.headers["authorization"];
   
    if (authHeader !== undefined) {
      jwtToken = authHeader.split(" ")[1];
    }
    if (jwtToken === undefined) {
      response.status(401);
      response.send("Invalid JWT Token");
    } else {
      jwt.verify(jwtToken, "SECRET_KEY", async (error, payLoad) => {
        if (error) {
          response.status(401);
          response.send("Invalid JWT Token");
        } else {
          
        
          const { email, id, facultybranch, facultygroup, facultyyear } = payLoad;

     
          request.headers.email = email;
          request.headers.id = id;
          request.headers.facultybranch = facultybranch;
          request.headers.facultygroup = facultygroup;
          request.headers.facultyyear = facultyyear;
  
          next();
        }
      });
    }
  };
 
  const authenticatesecurity = (request, response, next) => {
    let jwtToken;
    const authHeader = request.headers["authorization"];
    //console.log("Authorization Header:", authHeader);
    if (authHeader !== undefined) {
      jwtToken = authHeader.split(" ")[1];
    }
    if (jwtToken === undefined) {
      response.status(401);
      response.send("Invalid JWT Token");
    } else {
      jwt.verify(jwtToken, "SECRET_KEY", async (error, payLoad) => {
        if (error) {
          response.status(401);
          response.send("Invalid JWT Token");
        } else {
        
     
          const { id, email, facultybranch, facultygroup, facultyyear } = payLoad;
          request.headers.id = id;
          request.headers.email = email;
          request.headers.facultybranch = facultybranch;
          request.headers.facultygroup = facultygroup;
          request.headers.facultyyear = facultyyear;
  
          next();
        }
      });
    }
  };

 
  
  app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });



  app.post('/submitTip', (req, res) => {
   
    const { name, phone, incidentDetails } = req.body;
    const insertQuery = `INSERT INTO crime_tips (name, phone, incident_details) VALUES (?, ?, ?)`;
    db.query(insertQuery, [name, phone, incidentDetails], (err, result) => {
        if (err) {
            res.status(500).send('Error submitting tip');
            throw err;
        }
        res.send('Tip submitted successfully');
    });
});

//visitors


app.get('/api/faculty', (req, res) => {
  db.query('SELECT id,firstname,lastname FROM faculty', (err, results) => {
     
      console.log(err)
      res.json(results);
  });
});

// Register a visit
app.post('/api/security/register-visit', (req, res) => {
  const { visitorName, contact, facultyId, reason } = req.body;
  const visitTime = new Date().toISOString().slice(0, 19).replace('T', ' ');

  db.query('INSERT INTO Visitors (name, contact) VALUES (?, ?)', [visitorName, contact], (err, result) => {
      if (err) throw err;
      const visitorId = result.insertId;

      db.query('INSERT INTO Visits (visitor_id, faculty_id, reason, visit_time) VALUES (?, ?, ?, ?)',
          [visitorId, facultyId, reason, visitTime], (err, result) => {
              if (err) throw err;
              res.json({ message: 'Visit request submitted successfully' });
          });
  });
});

//===========security=========//
app.get('/api/security/visitrequests',authenticatesecurity,async (req, res) => {
  
  const query = `
      SELECT 
          v.id AS vid, 
          vis.name AS visitor_name, 
          vis.contact, 
          v.reason, 
          CONCAT(f.firstname, ' ', f.lastname) AS faculty_name, 
          v.status,
          vis.id AS visitor_id
      FROM 
          Visits v
      JOIN 
          Visitors vis ON v.visitor_id = vis.id
      JOIN 
          faculty f ON v.faculty_id = f.id
      WHERE 
          v.status IN ('Pending', 'Waiting', 'Accepted', 'Ignored')
      ORDER BY vid DESC
  `;
  
  db.query(query, (err, results) => {
      if (err) throw err;
      res.json(results);
  });
});

app.post('/api/security/process-visit',authenticatesecurity,async(req, res) => {
  const { visitId, status } = req.body;
  console.log(visitId)
  
  const query = `UPDATE Visits SET status = ? WHERE id = ?`;
  db.query(query, [status, visitId], (err, result) => {
      if (err) throw err;
      res.json({ message: `Visit request has been ${status.toLowerCase()}.` });
  });
   // Use facultyEmail to send the email
   sendEmailToFaculty(visitId);

});


app.post('/api/security/remove-visit',authenticatesecurity,async (req, res) => {
  const { visitId, visitorId } = req.body;
  

  const deleteVisitQuery = `DELETE FROM Visits WHERE id = ?`;
  db.query(deleteVisitQuery, [visitId], (err, result) => {
      if (err) throw err;
      
      const deleteVisitorQuery = `DELETE FROM Visitors WHERE id = ?`;
      db.query(deleteVisitorQuery, [visitorId], (err, result) => {
          if (err) throw err;
          res.json({ message: 'Visit and visitor details removed successfully' });
      });
  });
});

app.post('/securityloginform', async (req, res) => {
  const { username, password } = req.body;
  

  const selectUserQuery = 'SELECT * FROM security WHERE username = ?';
  db.query(selectUserQuery, [username], async (err, result) => {
      if (err) {
          console.error('Error querying database:', err);
          return res.status(500).send('Error querying database.');
      }

      if (result.length === 0) {
          return res.status(400).json({ error: 'Invalid Username' });
      }

      const dbUser = result[0];
      console.log(result)

      const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
      if (isPasswordMatched) {
          console.log(username);
          const payload = { username: username, id: dbUser.id };
          const jwtToken = jwt.sign(payload, "SECRET_KEY", { expiresIn: '1h' });

          res.set('Authorization', `Bearer ${jwtToken}`);
          res.status(200).json({ token: jwtToken });
      } else {
          return res.status(400).json({ error: 'Invalid Password' });
      }
  });
});




app.get('/securitylogout',authenticatesecurity,async  (req, res) => {

    res.status(200).json({ message: 'Logout successful' });
   
   
  });


//---faculty----//



app.get('/api/faculty/visitrequests',authenticateFacultyToken,async (req, res) => {
  
  const facultyId = req.headers.id; // Get the faculty ID from the request headers

  const query = `
      SELECT 
          v.id, 
          vis.name AS visitor_name, 
          vis.contact, 
          v.reason, 
          CONCAT(f.firstname, ' ', f.lastname) AS faculty_name, 
          v.status
      FROM 
          Visits v
      JOIN 
          Visitors vis ON v.visitor_id = vis.id
      JOIN 
          Faculty f ON v.faculty_id = f.id
      WHERE 
          v.status = 'Waiting' AND
          f.id = ?
  `;
  
  db.query(query, [facultyId], (err, results) => {
      if (err) throw err;
      res.json(results);
  });
});

app.post('/api/faculty/respond-visit',authenticateFacultyToken,async (req, res) => {
  const { visitId, status } = req.body;
  
  const query = `UPDATE Visits SET status = ? WHERE id = ?`;
  db.query(query, [status, visitId], (err, result) => {
      if (err) throw err;
      res.json({ message: `Visit request has been ${status.toLowerCase()}.` });
  });
});

app.post('/registerfaculty', facultyupload.single('file'), async(req, res) => {
  const { firstName, lastName, email, password, phone, dob, gender, address, teaching_year, selected_group,  selected_branch } = req.body;
  const imageUrl = '/facultyimages/'+req.file.filename;
  
const teachingGroup = Array.isArray(selected_group) ? selected_group.join(', ') : selected_group;
const teachingBranch = Array.isArray(selected_branch) ? selected_branch.join(', ') : selected_branch;
const teachingYear = Array.isArray(teaching_year) ? teaching_year.join(', ') : teaching_year;
const hashedPassword = await bcrypt.hash(req.body.password, 10);
  const sql = "INSERT INTO faculty (firstname, lastname, faculty_email, password, phone, dob, gender, address, teaching_year, teaching_group, faculty_imageurl, teaching_branch) VALUES (?, ?, ?, ?, ?, ?, ?,  ?, ?, ?, ?, ?)";
  db.query(sql, [firstName, lastName, email, hashedPassword, phone, dob, gender, address, teachingYear, teachingGroup,  imageUrl, teachingBranch], (err, result) => {
      if (err) {
          console.error('Error inserting data into database:', err);
          res.status(500).json({ error: 'Error inserting data into database' });
      } else {
          console.log('Data inserted successfully');
          res.redirect('/facultylogin.html?msg=registersuccess');
      }
  });
});



app.post('/facultylogin', (req, res) => {
    const { Email, password } = req.body;
   
  
    const selectUserQuery = 'SELECT * FROM faculty WHERE faculty_email = ?';
    db.query(selectUserQuery, [Email], async (err, result) => {
      if (err) {
        console.error('Error querying database:', err);
        res.status(500).send('Error querying database.');
        return;
      }
  
      if (result.length === 0) {
        return res.status(400).json({ error: 'Invalid Email' });
      }
  
      const dbUser = result[0];
      
      const isPasswordMatched = await bcrypt.compare(password, dbUser.password);
      if (isPasswordMatched === true) {
        const payload = {email:Email,id:dbUser.id,facultybranch:dbUser.teaching_branch,facultygroup:dbUser.teaching_group,facultyyear:dbUser.teaching_year};
        const jwtToken = jwt.sign(payload,"SECRET_KEY");
        
        res.set('Authorization', `Bearer ${jwtToken}`);
        res.status(200).json({ token: jwtToken});
      } else {
        return res.status(400).json({ error: 'Invalid Password' });
      }
    });
  });


app.get('/facultylogout' ,authenticateFacultyToken,async  (req, res) => {

    res.status(200).json({ message: 'Logout successful' });
   
   
});

/////////////////////////////////////////////////

const nm = require('nodemailer');
const fs = require('fs');
let savedOTPS = {

};
const bannerPath = path.join(__dirname, 'public', 'images', 'istockphoto-1412282189-612x612.jpg');
    

var transporter = nm.createTransport(
    {
        host: "smtp.gmail.com",
        port: 587,
        secure: false,
        auth: {
            user: 'guardianshield6@gmail.com',
            pass: 'cprs xkkx dcit dbwr'
        }
    }
);

app.post('/verify', (req, res) => {
  let otprecived = req.body.otp;
  let email = req.body.email;
  if (savedOTPS[email] == otprecived) {
      res.send("Verfied");
  }
  else {
      res.status(500).send("Invalid OTP")
  }
})


app.post('/sendfacultyotp', (req, res) => {
let email = req.body.email;
const sql = 'SELECT * FROM faculty WHERE faculty_email = ?';
const values = [email];

db.query(sql, values, (err, result) => {
if (err) {
  console.error('Error querying database:', err);
  res.status(500).send('Error querying database.');
} else {
  if (result.length > 0) {
    let digits = '0123456789';
    let limit = 4;
    let otp = ''
    for (i = 0; i < limit; i++) {
        otp += digits[Math.floor(Math.random() * 10)];

    }
    var options = {
        from: 'guardianshield6@gmail.com',
        to: `${email}`,
        subject: "Testing node emails",
        html: `<img src="cid:unique@banner.image" alt="Banner Image" width="1080px"/>
        <p>Enter the otp: ${otp} to verify your email address</p>
        `,
        attachments: [{
          filename: 'banner.jpg',
          path: bannerPath,
          cid: 'unique@banner.image' 
      }]

    };
    transporter.sendMail(
        options, function (error, info) {
            if (error) {
                console.log(error);
                res.status(500).send("couldn't send")
            }
            else {
                savedOTPS[email] = otp;
                setTimeout(
                    () => {
                        delete savedOTPS.email
                    }, 60000
                )
                res.send("sent otp")
            }

        }
    )
    
    
  } else {
  
    res.status(500).send("couldn't send")
  }
}
});

})

app.post("/resetfacultypassword", async(req,res)=>{
  const email = req.body.Email;
  const password  = req.body.password;
  const hashedPassword = await bcrypt.hash(password, 10);
  const updateSql = `UPDATE faculty SET password = ?  WHERE faculty_email = ?`;
  const values = [hashedPassword, email];

  db.query(updateSql, values, (err, result) => {
    if (err) {
      console.error('Error updating data into database:', err);
      res.status(500).send('Error updating data into database.');
    } else {
      
      res.json({ success: true, message: 'Password changed successfully' });
    }
  });
  
});

app.get('/branches', (req, res) => {
  const query = 'SELECT * FROM branches';
  db.query(query, (err, results) => {
      if (err) {
          console.error('Error fetching branches:', err);
          res.status(500).send('Server error');
          return;
      }
      res.json(results);
  });
});


app.get('/groups/:branchId', (req, res) => {
  const branchId = req.params.branchId;
  const query = 'SELECT * FROM group_details WHERE branch_id = ?';
  db.query(query, [branchId], (err, results) => {
      if (err) {
          console.error('Error fetching groups:', err);
          res.status(500).send('Server error');
          return;
      }
      res.json(results);
  });
});

function sendEmailToFaculty(visitId) {
  console.log(visitId)
  const query = `
      SELECT f.faculty_email 
      FROM visits v 
      JOIN faculty f ON v.faculty_id = f.id 
      WHERE v.id = ?`;

  db.query(query, [visitId], (err, result) => {
      if (err) {
          console.error("Database query error:", err);
          return res.status(500).send("Couldn't retrieve faculty email");
      }

      if (result.length === 0) {
          return res.status(404).send("No faculty email found for the provided visit ID");
      }

      const facultyEmail = result[0].faculty_email;

   

      var options = {
        from: 'guardianshield6@gmail.com',
        to: `${facultyEmail}`,
        subject: "Waiting for your response",
        html: `<img src="cid:unique@banner.image" alt="Banner Image" width="1080px"/>
        <p>Someone waiting for your response.Please Respond in Security Website</p>
        `,
        attachments: [{
          filename: 'banner.jpg',
          path: bannerPath,
          cid: 'unique@banner.image' 
      }]

    };

      transporter.sendMail(options, function (error, info) {
          if (error) {
              console.log("Error sending email:", error);
              return res.status(500).send("Couldn't send email");
          } else {
              console.log("Email sent successfully:", info.response);
              res.send("Email sent to faculty");
          }
      });
  });
}

const port = 3305;
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});