const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const swaggerDocjs = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { body, validationResult } = require('express-validator');
const path = require('path');
const nodemailer = require('nodemailer');
const cors = require('cors');
const secretkey = 'ffgfhhgjfgjs';
const fs = require('fs');


const app = express();
// for open the image in localhost to the image url
var dir = path.join(__dirname, 'uploads');
app.use(express.static(dir));
const port = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// for data database
mongoose.connect('mongodb://127.0.0.1/authdata', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});


const db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => {
  console.log('Connected to MongoDB');
});

app.listen(port,'0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});

app.use(cors());

// swagger integration
const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'My API Project Swagger Documentation',
            version: '1.0.0',
            description: 'API documentation for your Node.js API',
        },
    },

    security: [{ BearerAuth: [] }],
    apis: ["./app.js"],
}
    
const swaggerSpec = swaggerDocjs(options);

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// for auth model
const AuthData = require('./models/auth');



// const { User } = require("../models/user");

// function for hashpassword
async function hashpassword(password){
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);
    return hashedPassword;
 }




/**
 * @swagger
 * /register:
 *   post:
 *     summary: Register a new user
 *     description: Endpoint to register a new user with profile image upload
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *         
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               username:
 *                 type: string
 *               mobile:
 *                 type: string
 *               address:
 *                 type: string
 *               profileImage:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: User registered successfully
 *       400:
 *         description: Bad request
 */

// upload a file using multer

// Multer setup for file uploads
const storage = multer.diskStorage({
  
  destination: './uploads', 
  filename: function (req, file, cb) {
    // Use the current timestamp as the filename
    cb(null, Date.now() + path.extname(file.originalname));
    
  }
});

const upload = multer({ storage: storage });


// Express route to register a user with validation
app.post(
  '/register', upload.single('profileImage'), 
  [ 
    body('username').isString().isLength({ min: 3 }),
    body('password').isString().isLength({ min: 6 }),
    body('mobile').isString().notEmpty().isLength({ min: 10, max: 12 }),
  ],
  async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { name, username, password, email, mobile, address } = req.body;
      const profileImage = req.file ? req.file.filename : null;

      console.log(profileImage)
    

      // Check if the username or email already exists
      const existingUser = await AuthData.findOne({ $or: [{ username }, { email }] });
      if (existingUser) {
        fs.unlink(`./uploads/${profileImage}`, (err) => {
            return;
        });
        return res.status(400).json({ message: 'Username or email already exists' });
      }

      // Hash the password
      const hashedPassword = await hashpassword(password);

      // Get the current date
      const date = new Date();

      // Create a new user with the hashed password
      const newUser = new AuthData({ name, username, password: hashedPassword, email, mobile, address,date,profileImage });

      // Save the user to the database
      await newUser.save();


 // Send confirmation email
 const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'prepostsurvey1@gmail.com',
    pass: 'diivqcoebavzsuzt',
  },
});

const mailOptions = {
  from: 'prepostsurvey1@gmail.com',
  to: email,
  subject: 'Registration Confirmation',

  html: `
  <h2>Welcome to Our Platform</h2>
  <p>Hi ${name},</p>
  <p>Thank you for registering with us! To complete your registration</p>
  <p>Username: ${username}</p> 
  
  


  <img src="cid:${profileImage}" alt="Profile Image"  style="height: 200px; width: auto;"/>
  <p>If you did not request this registration, you can safely ignore this email.</p>
  
  <p>Best regards,<br>Our Team</p>
  `,
  attachments: [
    {
      filename: profileImage,
      path: `uploads/${profileImage}`,
      cid: profileImage,
    },
  ],
};

try {
  await transporter.sendMail(mailOptions);
  console.log('Email sent');
} catch (error) {
  console.error('Error sending email:', error);
}

      res.status(201).json({ message: 'Registration successful', auth: newUser });
    } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
    }
  }
);


/**
 * @swagger
 * /forgot-password:
 *   post:
 *     summary: Send Password Reset Link to the mail
 *     description: Endpoint to initiate the forgot password process
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password reset instructions sent successfully
 *       400:
 *         description: Bad request or email not found
 *       500:
 *         description: Internal Server Error
 */

// Express route for forget password
app.post('/forgot-password', 
  [ 
    body('email').isEmail(),
  ],
  async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { email } = req.body;

      // Check if the email exists
      const user = await AuthData.findOne({ email });
      if (!user) {
        return res.status(400).json({ message: 'Email not found' });
      }

      // Generate a JWT token for password reset
const token = jwt.sign({ id: user._id, email: user.email }, secretkey, { expiresIn: '1h' });

      // Send password reset instructions via email
      // const resetLink = `http://localhost:3000/reset-password/${token}`;
      const resetLink = `http://localhost:3000/createnewpassword/${token}`;
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: 'prepostsurvey1@gmail.com',
          pass: 'diivqcoebavzsuzt',
        },
      });

      const mailOptions = {
        from: 'prepostsurvey1@gmail.com',
        to: email,
        subject: 'Password Reset Instructions',
        html: `
          <p>Hi ${user.name},</p>
          <p>Please follow the link below to reset your password:</p>
          <a href="${resetLink}">${resetLink}</a>
          <p>The link is valid for 1 hour.</p>
        `,
      };

      await transporter.sendMail(mailOptions);
      console.log('Password reset instructions sent');
      res.status(200).json({ message: 'Password reset instructions sent successfully' ,token:token});
    } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
    }
  }
);

/**
* @swagger
* /reset-password:
*   post:
*     summary: For Reset the Password
*     description: Endpoint to reset user password
*     requestBody:
*       content:
*         application/json:
*           schema:
*             type: object
*             properties:
*               token:
*                 type: string
*               newPassword:
*                 type: string
*     responses:
*       200:
*         description: Password reset successful
*       400:
*         description: Bad request or invalid token
*       500:
*         description: Internal Server Error
*/

// Express route for password reset
app.post('/reset-password', 
  [ 
    body('token').isString(),
    body('newPassword').isString().isLength({ min: 6 }),
  ],
  async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    try {
      const { token, newPassword } = req.body;

      // Verify the token
      let decoded;
      try {
        decoded = jwt.verify(token, secretkey);
      } catch (error) {
        return res.status(400).json({ message: 'Invalid token' });
      }

      const { id, email } = decoded;

      // Find the user by email and update the password
      const user = await AuthData.findOne({ _id: id, email }).exec();

      if (!user) {
        return res.status(400).json({ message: 'User not found' });
      }

      // Update the user's password in the database
      const hashedPassword = await hashpassword(newPassword);
      user.password = hashedPassword;
      await user.save();

      // Respond with success
     
      res.status(200).json({ message: 'Password reset successful'});
    } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
    }
  }
);



// get all the registered user data

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Get all registered users
 *     description: Retrieve data for all registered users
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             example:
 *               - name: 'User 1'
 *                 username: 'user1'
 *                 email: 'user1@example.com'
 *                 mobile: '1234567890'
 *                 address: '123 Main St, City'
 *                              
 */
app.get('/users', async (req, res) => {
  try {
    const allUsers = await AuthData.find(); 
    res.status(200).json({ message: 'get a list of all all registered users', allUsers});
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});


 // compare password function
 async function comparePasswords(plaintextPassword, hashpassword) {
 
   // console.log('hashpassword',plaintextPassword,hashpassword);
     const match = await bcrypt.compare(plaintextPassword, hashpassword);
     // console.log("match",match);
     return match;
 }
 
// for login
/**
 * @swagger
 * /login:
 *   post:
 *     summary: Log in with a registered user
 *     description: Endpoint to log in with a registered user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: User logged in successfully
 *       401:
 *         description: Unauthorized
 */


 // Express route to login a user
   app.post('/login', async (req, res) => {
     try {
       const { username, password } = req.body;
   // console.log("password",password,email)
 
       // Find the user in the database
       const user = await AuthData.findOne({ username:username });
   
       // If the user doesn't exist or the passwords don't match, send an error response
       if (!user || !(await comparePasswords(password, user.password))) {
         return res.status(401).send('Invalid credentials');
       }
       let jwtSecretKey = secretkey; 
        let data = { 
            username:user.username ,
            email:user.email,
            ProfileImage:user.profileImage
        } 
      
        const token = jwt.sign(data, jwtSecretKey,{ expiresIn: '1h' }); 
       res.status(200).send({message:'Login successful', token:token});
     } catch (error) {
       console.error(error);
       res.status(500).send('Internal Server Error');
     }
   });
 

 /**
 * @swagger
 * components:
 *   securitySchemes:
 *     BearerAuth:
 *       type: http
 *       scheme: bearer
 * /profile:
*
 *   get:
 *     security:
 *       - BearerAuth: []
 *     summary: Get the data of the login user
 *     description: 
 *     responses:
 *       201:
 *         description: 
 *       401:
 *         description: Unauthorized - Invalid token
 *       403:
 *         description: Forbidden - Token not provided
 */


// Middleware to authenticate JWT
function authenticateJWT(req, res, next) {
  let token = req.header('Authorization');
  token = token?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  
// console.log(token);
  jwt.verify(token, secretkey, (err, auth) => {
    if (err) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    req.auth = auth;
    next();
  });
}


// Example endpoint to get all data registered by the user
app.get('/profile', authenticateJWT, async (req, res) => {
  try {
    // Assuming you stored user information in a collection named 'users'
    const userData = await AuthData.find({ username: req.auth.username });

    res.status(200).json({ message: 'User data retrieved successfully', data: userData });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// get the data by id

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Get user data by ID
 *     description: Retrieve user data by providing the user ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the user to retrieve
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             example:
 *               name: 'User 1'
 *               username: 'user1'
 *               email: 'user1@example.com'
 *               mobile: '1234567890'
 *               address: '123 Main St, City'
 *       400:
 *         description: User not found
 */
app.get('/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await AuthData.findById(userId);

    if (user) {
      res.status(200).json(user);
    } else {
      res.status(400).json({ message: 'User not found' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});


// update the data 
/**
 * @swagger
 * /users/{id}:
 *   put:
 *     summary: Update a user by ID
 *     description: Update user data by providing the user ID
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: ID of the user to update
 *         
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               username:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               mobile:
 *                 type: string
 *               address:
 *                 type: string
 *               profileImage:
 *                 type: string
 *                 format: binary
 *             example:
 *               name: John Doe
 *               username: johndoe
 *               email: john@example.com
 *               mobile: "1234567890"
 *               address: Some Address
 *               profileImage: (binary data)
 *     responses:
 *       200:
 *         description: User updated successfully
 *       400:
 *         description: Bad request
 */

app.put(
  '/users/:id',
  upload.single('profileImage'),
  [
    body('username').isString().isLength({ min: 3 }),
    body('mobile').isString().notEmpty().isLength({ min: 10, max: 12 }),
  ],
  async (req, res) => {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    try {
      const userId = req.params.id;
      const updatedUserData = req.body;
      const profileImage = req.file ? req.file.filename : null;

      // If there is a profileImage in the request, then update the profileimage
      if (profileImage) {
        updatedUserData.profileImage = profileImage;
      }

      // Find the user with the provided ID and update user data
      const updatedUser = await AuthData.findByIdAndUpdate(userId, updatedUserData,{new:true});

      if (updatedUser) {
        res.status(200).json({ message: 'User updated successfully', user: updatedUser });
      } else {
        res.status(400).json({ message: 'User not found' });
      }
    } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
    }
  }
);


/**
 * @swagger
 * /users/{id}:
 *   delete:
 *     summary: Delete a user by ID
 *     description: Delete a user based on their unique identifier
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         description: The ID of the user to delete
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User deleted successfully
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal Server Error
 */
app.delete('/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const deletedUser = await AuthData.findByIdAndDelete(userId);
    
    if (!deletedUser) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    res.json({ message: 'User deleted successfully',deletedUser });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

// appointment api fopr book appointment


// for appointment model
const newAppointmentData = require('./models/appointment');

// API endpoint to create an appointment
/**
 * @swagger
 * /appointments:
 *   post:
 *     summary: Book a new appointment
 *     description: Book a new appointment with name, email, phone, department, doctor, and reason.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               phone:
 *                 type: string
 *               department:
 *                 type: string
 *               doctor:
 *                 type: string
 *               reason:
 *                 type: string
 *     responses:
 *       201:
 *         description: Successfully created an appointment
 *         content:
 *           application/json:
 *             example:
 *               name: John Doe
 *               email: john.doe@example.com
 *               phone: 1234567890
 *               department: Cardiology
 *               doctor: Dr. Smith
 *               reason: Regular checkup
 * 
 */
 
app.post('/appointments',
[ 
  body('name').isString().isLength({ min: 3 }),
  body('phone').isString().notEmpty().isLength({ min: 10, max: 12 }),
],
async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  
try{
  const { name, email, phone, department, doctor, reason } = req.body;

   // Check if the phone or email already exists
   const existingAppointment = await newAppointmentData.findOne({ $or: [{ phone }, { email }] });
   if (existingAppointment) {
     return res.status(400).json({ message: 'phone or email already exists' });
   }
  /// Get the current date
  const date = new Date();

      // Create a new appointment with the email
      const newData = new newAppointmentData({ name, email, phone, department, doctor,date, reason});

      // Save the appointment to the database
       newData.save();

       
 // Send confirmation email
 const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'prepostsurvey1@gmail.com',
    pass: 'diivqcoebavzsuzt',
  },
});

const mailOptions = {
  from: 'prepostsurvey1@gmail.com',
  to: email,
  subject: 'Book an Appointment',

  html: `
  <p>Hi ${name},</p>

  <p>Your appointment has been confirmed. Here are the details:</p>
    
  <ul>
    
    <li><strong>Department:</strong> ${ department }</li>
    <li><strong>Doctor:</strong> ${ doctor }</li>
    <li><strong>Reason:</strong> ${ reason }</li>
   
  </ul>
  
  <p>Thank you for choosing our services. If you have any questions or need to reschedule, please contact us.</p>
  <p>Best regards,<br>Your Appointment Team</p>`
  
};

try {
  await transporter.sendMail(mailOptions);
  console.log('Email sent');
} catch (error) {
  console.error('Error sending email:', error);
}

      res.status(201).json({ message: 'Appointment booked successfully', appointment: newData });
    } catch (error) {
      console.error(error);
      res.status(500).send('Internal Server Error');
    }
  }
);

// API endpoint to get all appointments
/**
 * @swagger
 * /appointments:
 *   get:
 *     summary: Get all appointments
 *     description: Retrieve a list of all appointments.
 *     responses:
 *       200:
 *         description: Successfully retrieved appointments
 *         content:
 *           application/json:
 *             example:
 *               - name: John Doe
 *                 email: john.doe@example.com
 *                 phone: 1234567890
 *                 department: Cardiology
 *                 doctor: Dr. Smith
 *                 reason: Regular checkup
 *                 date: 2024-01-11T00:00:00.000Z
 */
app.get('/appointments',async (req, res) => {
  try {
    const allAppointments = await newAppointmentData.find(); 
    // res.json(allAppointments);

    res.status(200).json({ message: 'Get a list of all registered appointments', allAppointments });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
});

  



