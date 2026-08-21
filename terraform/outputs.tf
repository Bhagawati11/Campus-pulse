output "app_server_public_ip" {
  description = "SSH into this / put it in your Ansible inventory"
  value       = aws_instance.app_server.public_ip
}

output "rds_endpoint" {
  description = "Set this as DB_HOST in your backend .env once deployed"
  value       = aws_db_instance.postgres.address
}
