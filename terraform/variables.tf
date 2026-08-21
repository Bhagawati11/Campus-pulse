variable "aws_region" {
  description = "AWS region to deploy into"
  type        = string
  default     = "ap-south-1" # Mumbai — closest to Pune
}

variable "project_name" {
  type    = string
  default = "campus-pulse"
}

variable "instance_type" {
  description = "EC2 instance type for the app server"
  type        = string
  default     = "t2.micro" # free-tier eligible
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro" # free-tier eligible
}

variable "db_username" {
  type    = string
  default = "postgres"
}

variable "db_password" {
  description = "RDS master password — pass via terraform.tfvars or -var, never commit it"
  type        = string
  sensitive   = true
}

variable "my_ip" {
  description = "Your IP in CIDR form, e.g. 49.36.xx.xx/32 — used to lock down SSH access"
  type        = string
}

variable "key_pair_name" {
  description = "Name of an existing EC2 key pair for SSH access"
  type        = string
}
