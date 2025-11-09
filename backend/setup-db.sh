#!/bin/bash

# Database Setup Script for E2E Chat App

echo "Setting up PostgreSQL database for E2E Chat App..."

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "PostgreSQL is not installed. Please install it first."
    exit 1
fi

# Database name
DB_NAME="e2e_chat"

# Check if database exists
if psql -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
    echo "Database '$DB_NAME' already exists."
    read -p "Do you want to drop and recreate it? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Dropping existing database..."
        dropdb $DB_NAME
    else
        echo "Using existing database."
        exit 0
    fi
fi

# Create database
echo "Creating database '$DB_NAME'..."
createdb $DB_NAME

if [ $? -eq 0 ]; then
    echo "Database '$DB_NAME' created successfully!"
    echo "The schema will be automatically created when you start the server."
    echo ""
    echo "Next steps:"
    echo "1. Copy .env.example to .env and configure your database credentials"
    echo "2. Run 'npm install' to install dependencies"
    echo "3. Run 'npm run dev' to start the server"
else
    echo "Failed to create database. Please check your PostgreSQL installation and permissions."
    exit 1
fi

