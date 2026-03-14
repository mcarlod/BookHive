import express from "express";
import cloudinary from "../lib/cloudinary.js";
import Book from "../models/Book.js";
import protectRoute from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/", protectRoute, async (req, res) => {
    try {
        const {title, caption, rating, image} = req.body;

        if (!image || !title || !caption || !rating) {
            return res.status(400).json({ message: "Please provide all fields"});
        }

        //upload image to cloudinary
        const uploadResponse = await cloudinary.uploader.upload(image);
        const imageUrl = uploadResponse.secure_url;

        //save to db
        const newBook = new Book({
            title,
            caption,
            rating,
            image: imageUrl,
            user: req.user._id,
        })
        //save newBook to db
        await newBook.save()

        res.status(201).json(newBook)

    } catch (error) {
        console.log("Error creating book:", error)
        res.status(500).json({ error: error.message });

    }
})

// pagination
router.get("/", protectRoute, async (req, res) => {
    try {
        const page = req.query.page || 1;
        const limit = req.query.limit || 2;
        const skip = (page - 1) * limit;

        const books = await Book.find()
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate("user", "username profileImage");

        const totalBooks = await Book.countDocuments();

        res.send({
            books,
            currentPage: page,
            totalBooks,
            totalPages: Math.ceil(totalBooks / limit),
        });
    } catch (error) {
        console.log("Error getting book:", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
})

// get recommended books by the logged-in user
router.get("/user", protectRoute, async (req, res) => {
    try {
        // find all books posted by current user
        const books = await Book.find({ user: req.user._id }).sort({ createdAt: -1 });
        res.json(books);
    } catch (error) {
        console.log("Get user books error: ", error.message);
        res.status(500).json({ message: "Server Error" });
    }
});

router.delete("/:id", protectRoute, async (req, res) => {
    try {
        const book = await Book.findById(req.params.id);
        if (!book) return res.status(401).json({ message: "Book not found" });

        //check if user is creator of the book
        if(book.user.toString() !== req.user._id.toString()) return res.status(401).json({ message: "Unauthorized" });

        //delete image from cloudinary
        if(book.image && book.image.includes("cloudinary")) {
            try {
                const publicId = book.image.split("/").pop().split(".")[0];
                await cloudinary.uploader.destroy(publicId);
            } catch (deleteError) {
                console.log("Error deleting image from cloudinary", deleteError);
            }
        }
        await book.deleteOne();
        res.json({ message: "Book deleted" });
    } catch (error) {
        console.log("Error deleting book", error);
        res.status(500).json({ message: "Internal Server Error" });
    }
})


export default router;